// A game's chat: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, createGame, joinGame } from './testSupport.js';

test('a chat message is broadcast with the sender\'s name, colour and hat', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#38fedc', hat: 'crown' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });

    const both = Promise.all([waitForEvent(alice, 'chatMessage'), waitForEvent(bob, 'chatMessage')]);
    alice.emit('chatMessage', { text: '  salut  ' });
    const [fromAlice, fromBob] = await both;
    for (const message of [fromAlice, fromBob]) {
      assert.equal(message.text, 'salut');
      assert.equal(message.name, 'Alice');
      assert.equal(message.color, '#38fedc');
      assert.equal(message.hat, 'crown');
    }
  } finally {
    server.close();
  }
});

test('a player joining a game receives that game\'s existing chat history', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    const sent = waitForEvent(alice, 'chatMessage');
    alice.emit('chatMessage', { text: 'premier' });
    await sent;

    const bob = await server.connect();
    const history = waitForEvent(bob, 'chatHistory');
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });
    assert.deepEqual((await history).map((m) => m.text), ['premier']);
  } finally {
    server.close();
  }
});

test('blank or whitespace-only chat messages are dropped', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    const received = [];
    alice.on('chatMessage', (message) => received.push(message.text));
    alice.emit('chatMessage', { text: '   ' });
    alice.emit('chatMessage', { text: '' });
    const real = waitForEvent(alice, 'chatMessage');
    alice.emit('chatMessage', { text: 'vrai' });
    await real;
    assert.deepEqual(received, ['vrai']);
  } finally {
    server.close();
  }
});
