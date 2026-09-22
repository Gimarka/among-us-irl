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

// io.close() alone only stops accepting new connections and waits for
// existing ones to end on their own - a socket a test killed abruptly
// (engine.close(), simulating a real network drop) can be left as a raw
// connection the HTTP server still considers open, which keeps this test
// process from ever exiting once enough of these tests have run.
// closeAllConnections() forces every one of them shut immediately.
function closeGameServer({ httpServer, io }) {
  io.close();
  httpServer.closeAllConnections();
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
    closeGameServer({ httpServer, io });
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
    closeGameServer({ httpServer, io });
  }
});

test('a player joining with a colour already in use is switched to a free one', async () => {
  clearPlayers();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);
  const bob = ioClient(url);

  try {
    await Promise.all([waitForEvent(alice, 'connect'), waitForEvent(bob, 'connect')]);

    const firstJoin = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    alice.emit('join', { name: 'Alice', color: '#c51111' });
    await firstJoin;

    const secondJoin = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    bob.emit('join', { name: 'Bob', color: '#c51111' });
    const [players] = await secondJoin;

    const alicePlayer = players.find((p) => p.name === 'Alice');
    const bobPlayer = players.find((p) => p.name === 'Bob');
    assert.equal(alicePlayer.color, '#c51111');
    assert.notEqual(bobPlayer.color, '#c51111', 'colour already taken must not be handed out again');
  } finally {
    alice.close();
    bob.close();
    closeGameServer({ httpServer, io });
  }
});

test('a reconnecting player keeps their own colour instead of being bumped off it', async () => {
  clearPlayers();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);

  try {
    await waitForEvent(alice, 'connect');

    const firstJoin = waitForEvent(alice, 'players');
    alice.emit('join', { name: 'Alice', color: '#38fedc', clientId: 'alice-client' });
    await firstJoin;

    const secondJoin = waitForEvent(alice, 'players');
    alice.emit('join', { name: 'Alice', color: '#38fedc', clientId: 'alice-client' });
    const players = await secondJoin;

    assert.equal(players.length, 1);
    assert.equal(players[0].color, '#38fedc');
  } finally {
    alice.close();
    closeGameServer({ httpServer, io });
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
    closeGameServer({ httpServer, io });
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
    closeGameServer({ httpServer, io });
  }
});

test('an unexpected disconnect keeps the player in the roster until the grace period runs out', async () => {
  clearPlayers();
  const { httpServer, io } = createGameServer({ disconnectGraceMs: 150 });
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const spectator = ioClient(url);
  // No auto-reconnect needed here - this test is only about the server's own
  // grace-period timer, and a client left endlessly retrying in the
  // background is exactly the kind of lingering handle that stops the test
  // process from exiting cleanly once the assertions are done.
  const flaky = ioClient(url, { reconnection: false });

  try {
    await Promise.all([waitForEvent(spectator, 'connect'), waitForEvent(flaky, 'connect')]);

    const joined = Promise.all([waitForEvent(spectator, 'players'), waitForEvent(flaky, 'players')]);
    flaky.emit('join', { clientId: 'flaky-client', name: 'Flaky' });
    await joined;

    // Close the raw transport rather than calling disconnect() - the same
    // way a locked phone or a Wi-Fi drop looks from the server's side,
    // skipping the clean handshake a deliberate disconnect would do.
    const removedBroadcast = waitForEvent(spectator, 'players');
    flaky.io.engine.close();

    let broadcastArrived = false;
    removedBroadcast.then(() => {
      broadcastArrived = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 80)); // well under the 150ms grace period
    assert.equal(broadcastArrived, false, 'no removal broadcast while the grace period is still running');

    const players = await removedBroadcast; // resolves once the grace period actually elapses
    assert.equal(players.find((p) => p.name === 'Flaky'), undefined, 'removed once the grace period ran out');
  } finally {
    spectator.close();
    flaky.close();
    closeGameServer({ httpServer, io });
  }
});

test('reconnecting during the grace period cancels the pending removal', async () => {
  clearPlayers();
  const { httpServer, io } = createGameServer({ disconnectGraceMs: 150 });
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const spectator = ioClient(url);
  // Sped up so the client's own auto-reconnect - which a real drop also
  // relies on - lands comfortably inside the short grace period above.
  const flaky = ioClient(url, { reconnectionDelay: 10, reconnectionDelayMax: 20 });

  try {
    await Promise.all([waitForEvent(spectator, 'connect'), waitForEvent(flaky, 'connect')]);

    const joined = Promise.all([waitForEvent(spectator, 'players'), waitForEvent(flaky, 'players')]);
    flaky.emit('join', { clientId: 'flaky-client', name: 'Flaky' });
    await joined;

    flaky.io.engine.close();

    // Socket.IO reconnects the transport on its own; the app re-joins with
    // the same clientId as soon as it does (see connectSocket in main.js).
    await waitForEvent(flaky, 'connect');
    const rejoined = Promise.all([waitForEvent(spectator, 'players'), waitForEvent(flaky, 'players')]);
    flaky.emit('join', { clientId: 'flaky-client', name: 'Flaky' });
    const [players] = await rejoined;
    assert.ok(players.find((p) => p.name === 'Flaky'), 'still present right after reconnecting');

    // Wait past the *original* grace deadline - if the first timer hadn't
    // been cancelled on rejoin, a stray removal would show up here.
    let strayRemoval = false;
    spectator.once('players', (p) => {
      if (!p.find((x) => x.name === 'Flaky')) strayRemoval = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    assert.equal(strayRemoval, false, 'never removed - the reconnect cancelled the original timer');
  } finally {
    spectator.close();
    flaky.close();
    closeGameServer({ httpServer, io });
  }
});

test('a deliberate disconnect (logout) removes the player immediately, ignoring the grace period', async () => {
  clearPlayers();
  // Long enough that only an *immediate* removal could show up in this test.
  const { httpServer, io } = createGameServer({ disconnectGraceMs: 60_000 });
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const spectator = ioClient(url);
  const leaver = ioClient(url);

  try {
    await Promise.all([waitForEvent(spectator, 'connect'), waitForEvent(leaver, 'connect')]);

    const joined = Promise.all([waitForEvent(spectator, 'players'), waitForEvent(leaver, 'players')]);
    leaver.emit('join', { clientId: 'leaver-client', name: 'Leaver' });
    await joined;

    const left = waitForEvent(spectator, 'players');
    leaver.disconnect(); // exactly what the "SE DECONNECTER" button does
    const players = await left;
    assert.equal(players.find((p) => p.name === 'Leaver'), undefined, 'removed right away, not after a long wait');
  } finally {
    spectator.close();
    leaver.close();
    closeGameServer({ httpServer, io });
  }
});

