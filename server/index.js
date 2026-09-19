import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { addPlayer, removePlayer, listPlayers } from './gameState.js';

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
    socket.on('join', (name) => {
      const cleanName = String(name || '').trim().slice(0, 20) || 'Joueur';
      const players = addPlayer(socket.id, cleanName);
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
