// Shared helpers for the *.integration.test.js files: a real game server on
// a random port, and fake phones that create or join games over real
// sockets. Not a test file itself (node --test only picks up *.test.js).
import { io as ioClient } from 'socket.io-client';
import { createGameServer } from './index.js';
import { clearSessions } from './sessionState.js';
import { clearCharacters } from './characterStore.js';

export function waitForEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A fresh server with no games or characters left over from another test.
// close() force-closes every connection too: io.close() alone waits for
// existing ones to end on their own, and a socket a test killed abruptly
// (engine.close(), simulating a real network drop) can otherwise keep the
// test process from ever exiting.
export async function startServer(options) {
  clearSessions();
  clearCharacters();
  const { httpServer, io } = createGameServer(options);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const sockets = [];
  return {
    // No auto-reconnect unless a test asks for it: a client left endlessly
    // retrying in the background would also keep the process alive.
    async connect(clientOptions = { reconnection: false }) {
      const socket = ioClient(`http://localhost:${httpServer.address().port}`, clientOptions);
      sockets.push(socket);
      await waitForEvent(socket, 'connect');
      return socket;
    },
    close() {
      sockets.forEach((socket) => socket.close());
      io.close();
      httpServer.closeAllConnections();
    },
  };
}

export function hello(socket, clientId) {
  const welcome = waitForEvent(socket, 'welcome');
  socket.emit('hello', { clientId });
  return welcome;
}

// NOUVELLE PARTIE. Resolves with the 'joined' payload.
export function createGame(socket, sessionName, player) {
  const joined = waitForEvent(socket, 'joined');
  socket.emit('createSession', { ...player, sessionName });
  return joined;
}

// REJOINDRE, picking a game from the list. Resolves with the 'joined' payload.
export function joinGame(socket, sessionId, player) {
  const joined = waitForEvent(socket, 'joined');
  socket.emit('joinSession', { ...player, sessionId });
  return joined;
}
