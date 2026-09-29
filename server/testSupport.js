// Shared helpers for the *.integration.test.js files: a real game server on
// a random port, and fake phones that create or join games over real
// sockets. Not a test file itself (node --test only picks up *.test.js).
//
// Each fake phone keeps the latest game state it was sent (phone.state), so
// a test can wait for the game to reach the state it expects (until).
import { io as ioClient } from 'socket.io-client';
import { createGameServer } from './index.js';
import { clearGames } from './games.js';
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
  clearGames();
  clearCharacters();
  const { httpServer, io } = createGameServer(options);
  await new Promise((resolve) => httpServer.listen(0, resolve));
  const url = `http://localhost:${httpServer.address().port}`;
  const sockets = [];
  return {
    url,
    // No auto-reconnect unless a test asks for it: a client left endlessly
    // retrying in the background would also keep the process alive.
    async connect(clientOptions = { reconnection: false }) {
      const socket = ioClient(url, clientOptions);
      sockets.push(socket);
      socket.state = null;
      socket.states = []; // every state received, oldest first
      socket.on('state', (state) => {
        socket.state = state;
        socket.states.push(state);
      });
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
  return socket.emitWithAck('hello', { clientId });
}

function keepState(socket, reply) {
  if (reply.ok) {
    socket.state = reply.state;
    socket.states.push(reply.state);
  }
  return reply;
}

// NOUVELLE PARTIE. Resolves with the server's answer ({ ok, state } or
// { ok: false, error }); the game's id is state.game.id.
export async function createGame(socket, sessionName, player) {
  return keepState(socket, await socket.emitWithAck('createGame', { ...player, sessionName }));
}

// REJOINDRE. Resolves with the server's answer, like createGame.
export async function joinGame(socket, sessionId, player) {
  return keepState(socket, await socket.emitWithAck('joinGame', { ...player, sessionId }));
}

export function leaveGame(socket) {
  return socket.emitWithAck('leaveGame', {});
}

// A phone action (see RULES in game.js). Resolves with { ok, error }.
export function act(socket, type, payload = {}) {
  return socket.emitWithAck('act', { type, ...payload });
}

// Resolves with the phone's state as soon as it matches - right away if the
// latest one already does. Fails the test after timeoutMs.
export function until(socket, matches, timeoutMs = 3000) {
  if (socket.state && matches(socket.state)) return Promise.resolve(socket.state);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('state', listener);
      reject(new Error(`state never matched: ${matches}`));
    }, timeoutMs);
    function listener(state) {
      if (!matches(state)) return;
      clearTimeout(timer);
      socket.off('state', listener);
      resolve(state);
    }
    socket.on('state', listener);
  });
}

// Several phones in one game's lobby: the first creates it (and is host),
// the others join. Each phone's clientId is its name in lower case.
export async function lobbyOf(server, names, gameName = 'Maison') {
  const phones = [];
  let gameId = null;
  for (const name of names) {
    const phone = await server.connect();
    const player = { clientId: name.toLowerCase(), name };
    const reply = gameId === null ? await createGame(phone, gameName, player) : await joinGame(phone, gameId, player);
    gameId = reply.state.game.id;
    phones.push(phone);
  }
  return { phones, gameId };
}

// A lobby whose host has pressed JOUER, with every phone having shown its
// role reveal - everyone on the main menu.
export async function startedGame(server, names, gameName) {
  const lobby = await lobbyOf(server, names, gameName);
  await act(lobby.phones[0], 'start');
  for (const phone of lobby.phones) {
    await until(phone, (state) => state.me.member);
    await act(phone, 'roleSeen');
  }
  return lobby;
}

export const playerNamed = (state, name) => state.players.find((player) => player.name === name);
