import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { addPlayer, removePlayer, listPlayers, findPlayerByClientId } from './gameState.js';

// Selfies arrive already shrunk and JPEG-compressed by the phone (a 160px
// square is a few KB). This cap only exists so a malformed or oversized
// payload can't sit in memory; the photo is dropped, the player still joins.
const MAX_PHOTO_LENGTH = 100_000;
const PHOTO_PREFIX = 'data:image/jpeg;base64,';

function cleanPhoto(photo) {
  if (typeof photo !== 'string') return null;
  if (!photo.startsWith(PHOTO_PREFIX)) return null;
  if (photo.length > MAX_PHOTO_LENGTH) return null;
  return photo;
}

const DEFAULT_COLOR = '#c51111';
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function cleanColor(color) {
  if (typeof color !== 'string') return DEFAULT_COLOR;
  return COLOR_PATTERN.test(color) ? color.toLowerCase() : DEFAULT_COLOR;
}

const DEFAULT_HAT = 'none';
const HAT_PATTERN = /^[a-z]{1,20}$/;

function cleanHat(hat) {
  if (typeof hat !== 'string') return DEFAULT_HAT;
  return HAT_PATTERN.test(hat) ? hat : DEFAULT_HAT;
}

// The browser makes this up once and keeps it in localStorage; it's what
// lets a reconnecting phone be recognised as the same player rather than a
// new one. A missing or malformed one (an older client, a bad payload)
// falls back to this connection's own socket id, which just means this
// particular join won't be merged with any other connection.
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function cleanClientId(clientId, fallback) {
  return typeof clientId === 'string' && CLIENT_ID_PATTERN.test(clientId) ? clientId : fallback;
}

// A dropped connection - phone locked, tab backgrounded, Wi-Fi hiccup - looks
// identical to actually leaving from here, and reconnecting after any of
// those is already handled client-side (it re-joins with the same clientId).
// So an unexpected disconnect doesn't remove the player right away: they
// stay in the shared roster, with this long to reconnect before they're
// actually treated as gone.
const DISCONNECT_GRACE_MS = 15 * 60 * 1000;

// Reasons Socket.IO reports when *we* end the connection on purpose, rather
// than it failing underneath us - the logout button (client-initiated) and
// evicting a since-replaced connection (server-initiated, see the 'join'
// handler below). Both mean the player is definitely not coming back on
// this connection, so there's nothing to wait out.
const IMMEDIATE_DISCONNECT_REASONS = new Set([
  'client namespace disconnect',
  'server namespace disconnect',
]);

export function createGameServer({ disconnectGraceMs = DISCONNECT_GRACE_MS } = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }, // dev only; tighten before real deployment
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true, players: listPlayers().length });
  });

  // clientId -> pending removal timer, for players riding out the grace
  // period above. Never more than one entry per clientId: joining or
  // disconnecting again both replace whatever was there before.
  const pendingRemovals = new Map();

  function cancelPendingRemoval(clientId) {
    const timer = pendingRemovals.get(clientId);
    if (timer) clearTimeout(timer);
    pendingRemovals.delete(clientId);
  }

  io.on('connection', (socket) => {
    socket.on('join', ({ clientId, name, photo, color, hat } = {}) => {
      const id = cleanClientId(clientId, socket.id);
      const cleanName = String(name || '').trim().slice(0, 20) || 'Joueur';

      // The same player can briefly hold two live connections - a second
      // tab, a phone that reconnected under a fresh socket just before its
      // old one timed out. Only one should count, so the previous
      // connection gets closed below. That has to happen *after* the
      // roster already reflects the new connection: disconnect() can fire
      // its 'disconnect' handler synchronously, and that handler's own
      // stale-connection check (see removePlayer) only stays correct if
      // this new entry is already in place by the time it runs - otherwise
      // it would broadcast Tyty as gone for an instant before reappearing.
      const existing = findPlayerByClientId(id);
      const previousSocketId = existing && existing.socketId !== socket.id ? existing.socketId : null;

      // Reconnecting - the same tab coming back, or a new one - before the
      // grace period ran out means they never really left.
      cancelPendingRemoval(id);

      socket.data.clientId = id;
      const players = addPlayer(
        id,
        socket.id,
        cleanName,
        cleanPhoto(photo),
        cleanColor(color),
        cleanHat(hat),
      );
      io.emit('players', players);

      if (previousSocketId) {
        io.sockets.sockets.get(previousSocketId)?.disconnect(true);
      }
    });

    socket.on('disconnect', (reason) => {
      const id = socket.data.clientId;
      if (!id) return; // disconnected before ever joining

      cancelPendingRemoval(id);

      if (IMMEDIATE_DISCONNECT_REASONS.has(reason)) {
        const players = removePlayer(id, socket.id);
        io.emit('players', players);
        return;
      }

      const timer = setTimeout(() => {
        pendingRemovals.delete(id);
        const players = removePlayer(id, socket.id);
        io.emit('players', players);
      }, disconnectGraceMs);
      pendingRemovals.set(id, timer);
    });
  });

  return { httpServer, io };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const PORT = process.env.PORT || 3000;
  const { httpServer } = createGameServer();
  httpServer.listen(PORT, () => {
    console.log(`Game server listening on port ${PORT}`);
  });
}
