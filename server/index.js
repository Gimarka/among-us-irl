// The game server: connections and messages. All game state and rules live
// in game.js; this file only connects phones to games.
//
// How phones stay in sync:
// - After anything changes in a game, every phone in it is sent its full
//   personal view of the game ('state', see viewFor in game.js), numbered
//   with a version. A phone never has to piece the game together from
//   separate messages, and one that missed some (asleep, offline) is fully
//   up to date again with the next one it gets - or the one it gets on
//   joining back. A phone whose view didn't change isn't sent anything.
// - Everything a phone does is an 'act' the server answers. A phone that
//   gets no answer keeps the action and sends it again once reconnected;
//   each action carries an id, so one that did arrive the first time isn't
//   done twice.
// - Heartbeats every 15 s notice a dead connection within ~25 s (and the
//   phone checks straight away when it comes back to the app). Players
//   whose phone dropped are marked offline for everyone.

import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import {
  cleanGameName,
  isGameNameTaken,
  addGame,
  getGame,
  deleteGame,
  listGames,
  rememberClientGame,
  getClientGame,
} from './games.js';
import { toWire } from './game.js';
import { saveCharacter, getCharacter, photoUrl, photoData } from './characterStore.js';
import { cleanClientId, cleanIdentity } from './clean.js';

// Socket.IO's heartbeat: a ping every pingInterval, and a phone that doesn't
// answer within pingTimeout is treated as disconnected.
const HEARTBEAT = { pingInterval: 15_000, pingTimeout: 10_000 };

// A dropped connection - phone locked, app in the background, Wi-Fi hiccup -
// looks identical to actually leaving from here, and the phone reconnects by
// itself after any of those. So the player stays in the game (shown offline)
// for this long before being treated as gone.
const DISCONNECT_GRACE_MS = 15 * 60 * 1000;

// Reasons Socket.IO reports when a connection was ended on purpose rather
// than failing underneath us: nothing to wait out.
const IMMEDIATE_DISCONNECT_REASONS = new Set(['client namespace disconnect', 'server namespace disconnect']);

// How many recent action ids are remembered per phone, to spot one sent
// again after a reconnect.
const RECENT_ACTION_IDS = 100;

const characters = { get: getCharacter, save: saveCharacter, photoUrl };

// Answers a phone's request, if it asked for an answer.
function respond(reply, value) {
  if (typeof reply === 'function') reply(value);
}

// timings: shorter durations for tests (see DEFAULT_TIMINGS in game.js).
export function createGameServer({ disconnectGraceMs = DISCONNECT_GRACE_MS, timings = {}, heartbeat = HEARTBEAT } = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' },
    ...heartbeat,
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true, sessions: listGames().length });
  });

  // Selfies, loaded by phones once each. The address has a version number
  // that changes with the photo, so it can be cached forever.
  app.get('/photos/:clientId', (req, res) => {
    const data = photoData(req.params.clientId);
    if (!data) {
      res.sendStatus(404);
      return;
    }
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    });
    res.send(data);
  });

  const connections = new Map(); // clientId -> the socket currently playing as them
  const pendingRemovals = new Map(); // clientId -> removal timer (see DISCONNECT_GRACE_MS)
  const recentActionIds = new Map(); // clientId -> ids of their latest actions
  const versions = new Map(); // game id -> version of its latest state

  // --- Sending states ---------------------------------------------------
  // Changes are gathered and sent once per tick, so several changes at once
  // (a vote that ends the vote) make one update, not several.
  const dirtyGames = new Set();
  let flushQueued = false;
  let lastSessionsJson = '';

  function markDirty(game) {
    dirtyGames.add(game);
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(flush);
  }

  function sendState(socket, game, version, now) {
    const view = game.viewFor(socket.data.clientId);
    const json = JSON.stringify(view);
    if (socket.data.lastStateJson === json) return; // nothing new for this phone
    socket.data.lastStateJson = json;
    socket.emit('state', { version, ...toWire(view, now) });
  }

  function flush() {
    flushQueued = false;
    const now = Date.now();
    dirtyGames.forEach((game) => {
      if (getGame(game.id) !== game) return; // deleted meanwhile
      const version = (versions.get(game.id) || 0) + 1;
      versions.set(game.id, version);
      game.playerIds().forEach((clientId) => {
        const socket = connections.get(clientId);
        if (socket && socket.data.gameId === game.id) sendState(socket, game, version, now);
      });
    });
    dirtyGames.clear();

    // The REJOINDRE list, live on every phone, whenever a game appears,
    // disappears, starts or changes size.
    const sessions = listGames();
    const sessionsJson = JSON.stringify(sessions);
    if (sessionsJson !== lastSessionsJson) {
      lastSessionsJson = sessionsJson;
      io.emit('sessions', sessions);
    }
  }

  const gameDeps = { timings, characters, onChange: markDirty };

  // --- Joining and leaving --------------------------------------------
  function currentGame(socket) {
    return getGame(socket.data.gameId);
  }

  function cancelPendingRemoval(clientId) {
    clearTimeout(pendingRemovals.get(clientId));
    pendingRemovals.delete(clientId);
  }

  // Out of the game's roster; the game is deleted once nobody is left.
  function removeFromGame(game, clientId) {
    game.removePlayer(clientId);
    if (game.playerCount() === 0) {
      deleteGame(game.id);
      versions.delete(game.id);
      markDirty(game); // for the REJOINDRE list
    }
  }

  function leaveCurrentGame(socket) {
    const game = currentGame(socket);
    const clientId = socket.data.clientId;
    socket.data.gameId = null;
    if (!game) return;
    if (connections.get(clientId) === socket) connections.delete(clientId);
    cancelPendingRemoval(clientId);
    removeFromGame(game, clientId);
  }

  // Puts this connection into a game: its lobby, or straight back into the
  // game itself for a player who already has a role in it. Answers with the
  // phone's view of the game.
  function enterGame(socket, game, identity, reply) {
    const clientId = identity.clientId;
    if (socket.data.gameId !== null && socket.data.gameId !== game.id) leaveCurrentGame(socket);

    // Back before the grace period ran out: they never really left.
    cancelPendingRemoval(clientId);

    // A phone plays one game at a time: still listed in another one (another
    // tab, or a connection riding out its grace period), it leaves that one.
    const previous = getClientGame(clientId);
    if (previous && previous.id !== game.id && previous.has(clientId)) removeFromGame(previous, clientId);

    // The same player can briefly have two connections (a second tab, a
    // phone that reconnected before its old connection timed out). Only the
    // newest counts; the old one is closed once this one is in place.
    const oldSocket = connections.get(clientId);
    socket.data.clientId = clientId;
    socket.data.gameId = game.id;
    connections.set(clientId, socket);
    game.addPlayer(clientId, identity);
    rememberClientGame(clientId, game.id);
    if (oldSocket && oldSocket !== socket) {
      oldSocket.data.gameId = null;
      oldSocket.disconnect(true);
    }

    const view = game.viewFor(clientId);
    socket.data.lastStateJson = JSON.stringify(view);
    respond(reply, { ok: true, state: { version: versions.get(game.id) || 0, ...toWire(view) } });
  }

  // Has this phone already sent this action (and it's being sent again
  // after a reconnect)? Actions without an id are never treated as repeats.
  function isRepeat(clientId, actionId) {
    if (typeof actionId !== 'string') return false;
    const recent = recentActionIds.get(clientId) || [];
    if (recent.includes(actionId)) return true;
    recent.push(actionId);
    if (recent.length > RECENT_ACTION_IDS) recent.shift();
    recentActionIds.set(clientId, recent);
    return false;
  }

  io.on('connection', (socket) => {
    socket.data.gameId = null;
    socket.emit('sessions', listGames());

    // A phone coming back to the app checking its connection still works.
    socket.on('stillThere', (reply) => respond(reply, true));

    // The first thing a phone asks: what did its character look like last
    // time, and is it still part of a running game it should go back to.
    socket.on('hello', ({ clientId } = {}, reply) => {
      const id = cleanClientId(clientId, socket.id);
      socket.data.clientId = id;
      const game = getClientGame(id);
      respond(reply, {
        character: getCharacter(id),
        resume: game ? { sessionId: game.id, inGame: game.isMember(id) } : null,
      });
    });

    // NOUVELLE PARTIE: a new, named game, with its creator as host.
    socket.on('createGame', (payload = {}, reply) => {
      const identity = cleanIdentity(payload, socket.id);
      const name = cleanGameName(payload.sessionName);
      if (!name) {
        respond(reply, { ok: false, error: 'name-empty' });
        return;
      }
      if (isGameNameTaken(name)) {
        respond(reply, { ok: false, error: 'name-taken' });
        return;
      }
      enterGame(socket, addGame(name, identity.clientId, gameDeps), identity, reply);
    });

    // REJOINDRE (one of the games from the list), or coming back to our game
    // after a dropped connection.
    socket.on('joinGame', (payload = {}, reply) => {
      const game = getGame(payload.sessionId);
      if (!game) {
        respond(reply, { ok: false, error: 'not-found' });
        return;
      }
      enterGame(socket, game, cleanIdentity(payload, socket.id), reply);
    });

    // Back to the character screen. The player keeps their role in a game
    // that has started (so they can come back to it), but not their place
    // in a lobby.
    socket.on('leaveGame', (_payload, reply) => {
      leaveCurrentGame(socket);
      respond(reply, { ok: true });
    });

    // Everything a player does in a game (see RULES in game.js).
    socket.on('act', (action = {}, reply) => {
      const game = currentGame(socket);
      const clientId = socket.data.clientId;
      if (!game || !game.has(clientId)) {
        respond(reply, { ok: false, error: 'not-in-game' });
        return;
      }
      if (isRepeat(clientId, action.id)) {
        respond(reply, { ok: true, repeat: true });
        return;
      }
      respond(reply, game.act(clientId, action.type, action));
    });

    // The chat messages a phone doesn't have yet (the state says which is
    // the latest one).
    socket.on('getChat', ({ afterId } = {}, reply) => {
      const game = currentGame(socket);
      const known = Number.isFinite(Number(afterId)) ? Number(afterId) : 0;
      respond(reply, game && game.has(socket.data.clientId) ? game.getChat(known) : []);
    });

    socket.on('disconnect', (reason) => {
      const clientId = socket.data.clientId;
      const game = currentGame(socket);
      // Not in a game, or a connection that has since been replaced.
      if (!clientId || !game || connections.get(clientId) !== socket) return;
      connections.delete(clientId);

      if (IMMEDIATE_DISCONNECT_REASONS.has(reason)) {
        removeFromGame(game, clientId);
        return;
      }

      game.setOnline(clientId, false);
      cancelPendingRemoval(clientId);
      pendingRemovals.set(clientId, setTimeout(() => {
        pendingRemovals.delete(clientId);
        const stillThere = getGame(game.id);
        const cameBack = connections.get(clientId)?.data.gameId === game.id;
        if (stillThere && stillThere.has(clientId) && !cameBack) removeFromGame(stillThere, clientId);
      }, disconnectGraceMs));
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
