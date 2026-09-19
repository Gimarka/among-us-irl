// Simulates two phones joining the same game: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createGameServer } from './index.js';
import { clearPlayers } from './gameState.js';

function listenOnRandomPort(server) {
  return new Promise((resolve) => {
    server.listen(0, () => resolve(server.address().port));
  });
}

function waitForEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

test('two players joining see each other in the players list', async () => {
  clearPlayers();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);
  const bob = ioClient(url);

  try {
    await Promise.all([waitForEvent(alice, 'connect'), waitForEvent(bob, 'connect')]);

    // Both sockets receive every broadcast, so wait for both before moving on
    // to avoid a listener registered after the fact missing the event.
    const aliceAlone = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    alice.emit('join', 'Alice');
    await aliceAlone;

    const bothJoined = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    bob.emit('join', 'Bob');
    const [fromAlice, fromBob] = await bothJoined;

    for (const players of [fromAlice, fromBob]) {
      assert.equal(players.length, 2);
      assert.deepEqual(players.map((p) => p.name).sort(), ['Alice', 'Bob']);
    }
  } finally {
    alice.close();
    bob.close();
    io.close();
  }
});
