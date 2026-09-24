// Plays whole sessions with fake players: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createGameServer } from './index.js';
import { clearPlayers } from './gameState.js';
import { endSession } from './sessionState.js';
import { clearCharacters } from './characterStore.js';

function listenOnRandomPort(server) {
  return new Promise((resolve) => {
    server.listen(0, () => resolve(server.address().port));
  });
}

function waitForEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

// See join.integration.test.js for why this (rather than a plain io.close())
// is needed to let the test process exit cleanly.
function closeGameServer({ httpServer, io }) {
  io.close();
  httpServer.closeAllConnections();
}

function hello(socket, clientId) {
  const welcome = waitForEvent(socket, 'welcome');
  socket.emit('hello', { clientId });
  return welcome;
}

async function connect(url) {
  const socket = ioClient(url, { reconnection: false });
  await waitForEvent(socket, 'connect');
  return socket;
}

async function join(socket, clientId, name) {
  const joined = waitForEvent(socket, 'players');
  socket.emit('join', { clientId, name });
  await joined;
}

function reset() {
  clearPlayers();
  endSession();
  clearCharacters();
}

test('a full session: start, late joiner, rejoin, end, and a fresh session after', async () => {
  reset();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;
  const sockets = [];

  try {
    const alice = await connect(url);
    const bob = await connect(url);
    sockets.push(alice, bob);

    assert.deepEqual(await hello(alice, 'alice'), { sessionId: null, member: false, character: null });

    await join(alice, 'alice', 'Alice');
    await join(bob, 'bob', 'Bob');

    // JOUER: both lobby players start together, and everyone hears the session id.
    const started = Promise.all([
      waitForEvent(alice, 'role'),
      waitForEvent(bob, 'role'),
      waitForEvent(alice, 'session'),
    ]);
    alice.emit('startGame');
    const [aliceStart, , { sessionId }] = await started;
    assert.equal(typeof sessionId, 'number');

    const chatSent = waitForEvent(bob, 'chatMessage');
    alice.emit('chatMessage', { text: 'salut' });
    await chatSent;

    // A newcomer during the session: not a member until CONTINUER, then always a crewmate.
    const carol = await connect(url);
    sockets.push(carol);
    const carolWelcome = await hello(carol, 'carol');
    assert.equal(carolWelcome.sessionId, sessionId);
    assert.equal(carolWelcome.member, false);
    await join(carol, 'carol', 'Carol');
    const carolRole = waitForEvent(carol, 'role');
    carol.emit('startGame');
    assert.equal((await carolRole).role, 'crewmate');

    // Alice leaves on purpose and comes back: same session, same tasks, no second reveal.
    alice.disconnect();
    const aliceAgain = await connect(url);
    sockets.push(aliceAgain);
    const aliceWelcome = await hello(aliceAgain, 'alice');
    assert.equal(aliceWelcome.member, true);
    assert.equal(aliceWelcome.character.name, 'Alice');

    let aliceGotRoleAgain = false;
    aliceAgain.on('role', () => { aliceGotRoleAgain = true; });
    const resumedTasks = waitForEvent(aliceAgain, 'tasks');
    aliceAgain.emit('join', { clientId: 'alice', name: 'Alice' });
    assert.deepEqual(await resumedTasks, aliceStart.tasks);
    assert.equal(aliceGotRoleAgain, false);

    // Everyone leaves: the session ends, but characters are kept.
    [aliceAgain, bob, carol].forEach((socket) => socket.disconnect());
    const dave = await connect(url);
    sockets.push(dave);
    await new Promise((resolve) => setTimeout(resolve, 50)); // let the disconnects land
    assert.equal((await hello(dave, 'dave')).sessionId, null);
    const aliceCharacter = (await hello(dave, 'alice')).character;
    assert.equal(aliceCharacter.name, 'Alice');

    // A new session starts from zero, with the next id.
    await join(dave, 'dave', 'Dave');
    const nextSession = Promise.all([waitForEvent(dave, 'session'), waitForEvent(dave, 'chatHistory')]);
    dave.emit('startGame');
    const [{ sessionId: nextId }, chat] = await nextSession;
    assert.equal(nextId, sessionId + 1);
    assert.deepEqual(chat, [], 'the previous session\'s chat must be gone');
  } finally {
    sockets.forEach((socket) => socket.close());
    closeGameServer({ httpServer, io });
  }
});

test('a lobby player whose phone was asleep at JOUER gets their reveal when they reconnect', async () => {
  reset();
  const { httpServer, io } = createGameServer({ disconnectGraceMs: 5000 });
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;
  const sockets = [];

  try {
    const alice = await connect(url);
    const bob = await connect(url);
    sockets.push(alice, bob);
    await join(alice, 'alice', 'Alice');
    await join(bob, 'bob', 'Bob');

    // Bob's connection drops without him leaving - he stays in the lobby roster.
    bob.io.engine.close();
    await new Promise((resolve) => setTimeout(resolve, 50));

    const aliceRole = waitForEvent(alice, 'role');
    alice.emit('startGame');
    await aliceRole;

    const bobAgain = await connect(url);
    sockets.push(bobAgain);
    assert.equal((await hello(bobAgain, 'bob')).member, true);
    const bobRole = waitForEvent(bobAgain, 'role');
    bobAgain.emit('join', { clientId: 'bob', name: 'Bob' });
    const { role } = await bobRole;
    assert.ok(role === 'crewmate' || role === 'imposter');
  } finally {
    sockets.forEach((socket) => socket.close());
    closeGameServer({ httpServer, io });
  }
});
