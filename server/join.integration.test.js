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
    alice.emit('join', { name: 'Alice' });
    await aliceAlone;

    const bothJoined = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    bob.emit('join', { name: 'Bob' });
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

test('a joining player keeps a valid selfie but not an oversized one', async () => {
  clearPlayers();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const withPhoto = ioClient(url);
  const withHugePhoto = ioClient(url);

  try {
    await Promise.all([waitForEvent(withPhoto, 'connect'), waitForEvent(withHugePhoto, 'connect')]);

    // Both sockets receive every broadcast, so wait for both before moving on
    // to avoid a listener registered after the fact catching the wrong one.
    const photo = `data:image/jpeg;base64,${'a'.repeat(500)}`;
    const firstJoin = Promise.all([
      waitForEvent(withPhoto, 'players'),
      waitForEvent(withHugePhoto, 'players'),
    ]);
    withPhoto.emit('join', { name: 'Alice', photo });
    await firstJoin;

    const secondJoin = Promise.all([
      waitForEvent(withPhoto, 'players'),
      waitForEvent(withHugePhoto, 'players'),
    ]);
    withHugePhoto.emit('join', {
      name: 'Bob',
      photo: `data:image/jpeg;base64,${'a'.repeat(200_000)}`,
    });
    const [players] = await secondJoin;

    const alice = players.find((p) => p.name === 'Alice');
    const bob = players.find((p) => p.name === 'Bob');
    assert.equal(alice.photo, photo);
    assert.equal(bob.photo, null, 'oversized photo is dropped, player still joins');
  } finally {
    withPhoto.close();
    withHugePhoto.close();
    io.close();
  }
});
