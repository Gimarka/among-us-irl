import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { addPlayer, removePlayer, listPlayers } from './gameState.js';

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

export function createGameServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }, // dev only; tighten before real deployment
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true, players: listPlayers().length });
  });

  io.on('connection', (socket) => {
    socket.on('join', ({ name, photo } = {}) => {
      const cleanName = String(name || '').trim().slice(0, 20) || 'Joueur';
      const players = addPlayer(socket.id, cleanName, cleanPhoto(photo));
      io.emit('players', players);
    });

    socket.on('disconnect', () => {
      const players = removePlayer(socket.id);
      io.emit('players', players);
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
