// Simulates two phones chatting in the same game: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createGameServer } from './index.js';
import { clearPlayers } from './gameState.js';
import { clearMessages } from './chatState.js';

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

test('a chat message is broadcast with the sender\'s name, colour and hat', async () => {
  clearPlayers();
  clearMessages();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);
  const bob = ioClient(url);

  try {
    await Promise.all([waitForEvent(alice, 'connect'), waitForEvent(bob, 'connect')]);

    const aliceJoined = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    alice.emit('join', { name: 'Alice', color: '#38fedc', hat: 'crown' });
    await aliceJoined;

    const bobJoined = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    bob.emit('join', { name: 'Bob' });
    await bobJoined;

    const bothReceive = Promise.all([waitForEvent(alice, 'chatMessage'), waitForEvent(bob, 'chatMessage')]);
    alice.emit('chatMessage', { text: 'salut tout le monde' });
    const [fromAlice, fromBob] = await bothReceive;

    for (const message of [fromAlice, fromBob]) {
      assert.equal(message.name, 'Alice');
      assert.equal(message.text, 'salut tout le monde');
      assert.equal(message.color, '#38fedc');
      assert.equal(message.hat, 'crown');
    }
  } finally {
    alice.close();
    bob.close();
    closeGameServer({ httpServer, io });
  }
});

test('a newly connecting player receives the existing chat history', async () => {
  clearPlayers();
  clearMessages();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);

  try {
    await waitForEvent(alice, 'connect');

    const joined = waitForEvent(alice, 'players');
    alice.emit('join', { name: 'Alice' });
    await joined;

    const sent = waitForEvent(alice, 'chatMessage');
    alice.emit('chatMessage', { text: 'premier message' });
    await sent;

    const bob = ioClient(url);
    const history = await waitForEvent(bob, 'chatHistory');
    assert.equal(history.length, 1);
    assert.equal(history[0].text, 'premier message');
    assert.equal(history[0].name, 'Alice');
    bob.close();
  } finally {
    alice.close();
    closeGameServer({ httpServer, io });
  }
});

test('blank or whitespace-only chat messages are dropped', async () => {
  clearPlayers();
  clearMessages();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);

  try {
    await waitForEvent(alice, 'connect');
    const joined = waitForEvent(alice, 'players');
    alice.emit('join', { name: 'Alice' });
    await joined;

    alice.emit('chatMessage', { text: '   ' });

    // Nothing to wait on for a message that should never arrive - send a
    // real one right behind it and confirm that's the only one that shows up.
    const received = waitForEvent(alice, 'chatMessage');
    alice.emit('chatMessage', { text: 'vrai message' });
    const message = await received;
    assert.equal(message.text, 'vrai message');
  } finally {
    alice.close();
    closeGameServer({ httpServer, io });
  }
});
