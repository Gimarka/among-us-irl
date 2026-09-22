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

test('a joining player keeps a valid colour and hat, and falls back on bad ones', async () => {
  clearPlayers();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const picked = ioClient(url);
  const garbage = ioClient(url);

  try {
    await Promise.all([waitForEvent(picked, 'connect'), waitForEvent(garbage, 'connect')]);

    const firstJoin = Promise.all([waitForEvent(picked, 'players'), waitForEvent(garbage, 'players')]);
    picked.emit('join', { name: 'Alice', color: '#38FEDC', hat: 'crown' });
    await firstJoin;

    const secondJoin = Promise.all([waitForEvent(picked, 'players'), waitForEvent(garbage, 'players')]);
    garbage.emit('join', { name: 'Bob', color: 'javascript:alert(1)', hat: '<script>' });
    const [players] = await secondJoin;

    const alice = players.find((p) => p.name === 'Alice');
    const bob = players.find((p) => p.name === 'Bob');
    assert.equal(alice.color, '#38fedc');
    assert.equal(alice.hat, 'crown');
    assert.equal(bob.color, '#c51111', 'bad colour falls back');
    assert.equal(bob.hat, 'none', 'bad hat falls back');
  } finally {
    picked.close();
    garbage.close();
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

test('the same clientId reconnecting (a second tab) replaces the old connection instead of duplicating', async () => {
  clearPlayers();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const spectator = ioClient(url);
  const firstTab = ioClient(url);

  try {
    await Promise.all([waitForEvent(spectator, 'connect'), waitForEvent(firstTab, 'connect')]);

    const firstJoin = Promise.all([waitForEvent(spectator, 'players'), waitForEvent(firstTab, 'players')]);
    firstTab.emit('join', { clientId: 'same-browser', name: 'Tyty' });
    await firstJoin;

    // A second tab in the same browser, same saved identity/clientId.
    const secondTab = ioClient(url);
    await waitForEvent(secondTab, 'connect');

    const secondJoinSeen = Promise.all([
      waitForEvent(spectator, 'players'),
      waitForEvent(secondTab, 'players'),
    ]);
    // The first tab's connection getting closed by the server also fires a
    // 'players' broadcast (its own disconnect handler runs) - wait for that
    // too so we're asserting on the final, settled roster.
    const firstTabClosed = waitForEvent(firstTab, 'disconnect');
    secondTab.emit('join', { clientId: 'same-browser', name: 'Tyty' });
    const [players] = await secondJoinSeen;
    await firstTabClosed;

    const matches = players.filter((p) => p.name === 'Tyty');
    assert.equal(matches.length, 1, 'only one entry for the same clientId, not two');
    assert.equal(firstTab.connected, false, 'the replaced tab gets disconnected, not left as a ghost');

    secondTab.close();
  } finally {
    spectator.close();
    firstTab.close();
    io.close();
  }
});
