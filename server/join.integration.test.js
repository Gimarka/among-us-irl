// Phones joining the same game and its roster: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, wait, createGame, joinGame } from './testSupport.js';

test('two players in the same game see each other in the players list', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });

    const bothSee = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });
    const [fromAlice, fromBob] = await bothSee;

    for (const players of [fromAlice, fromBob]) {
      assert.deepEqual(players.map((p) => p.name).sort(), ['Alice', 'Bob']);
    }
  } finally {
    server.close();
  }
});

test('a joining player keeps a valid colour and hat, and falls back on bad ones', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#38FEDC', hat: 'crown' });

    const roster = waitForEvent(alice, 'players');
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob', color: 'javascript:alert(1)', hat: '<script>' });
    const players = await roster;

    const alicePlayer = players.find((p) => p.name === 'Alice');
    const bobPlayer = players.find((p) => p.name === 'Bob');
    assert.equal(alicePlayer.color, '#38fedc');
    assert.equal(alicePlayer.hat, 'crown');
    assert.match(bobPlayer.color, /^#[0-9a-f]{6}$/, 'bad colour replaced by a real one');
    assert.notEqual(bobPlayer.color, '#38fedc', 'and not one already taken');
    assert.equal(bobPlayer.hat, 'none', 'bad hat falls back');
  } finally {
    server.close();
  }
});

test('colours are unique within a game, but two games can use the same one', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const carol = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#c51111' });

    const roster = waitForEvent(alice, 'players');
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob', color: '#c51111' });
    const players = await roster;
    assert.equal(players.find((p) => p.name === 'Alice').color, '#c51111');
    assert.notEqual(players.find((p) => p.name === 'Bob').color, '#c51111', 'taken in this game');

    const otherRoster = waitForEvent(carol, 'players');
    await createGame(carol, 'Jardin', { clientId: 'carol', name: 'Carol', color: '#c51111' });
    assert.equal((await otherRoster)[0].color, '#c51111', 'free in a different game');
  } finally {
    server.close();
  }
});

test('a reconnecting player keeps their own colour instead of being bumped off it', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#38fedc' });

    const roster = waitForEvent(alice, 'players');
    await joinGame(alice, sessionId, { clientId: 'alice', name: 'Alice', color: '#38fedc' });
    const players = await roster;

    assert.equal(players.length, 1);
    assert.equal(players[0].color, '#38fedc');
  } finally {
    server.close();
  }
});

test('a joining player keeps a valid selfie but not an oversized one', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const photo = `data:image/jpeg;base64,${'a'.repeat(500)}`;
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', photo });

    const roster = waitForEvent(alice, 'players');
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob', photo: `data:image/jpeg;base64,${'a'.repeat(200_000)}` });
    const players = await roster;

    assert.equal(players.find((p) => p.name === 'Alice').photo, photo);
    assert.equal(players.find((p) => p.name === 'Bob').photo, null, 'oversized photo is dropped, player still joins');
  } finally {
    server.close();
  }
});

test('the same clientId reconnecting (a second tab) replaces the old connection instead of duplicating', async () => {
  const server = await startServer();
  try {
    const spectator = await server.connect();
    const firstTab = await server.connect();
    const { sessionId } = await createGame(spectator, 'Maison', { clientId: 'spectator', name: 'Spec' });
    await joinGame(firstTab, sessionId, { clientId: 'same-browser', name: 'Tyty' });

    const secondTab = await server.connect();
    const firstTabClosed = waitForEvent(firstTab, 'disconnect');
    const roster = waitForEvent(spectator, 'players');
    await joinGame(secondTab, sessionId, { clientId: 'same-browser', name: 'Tyty' });
    const players = await roster;
    await firstTabClosed;

    assert.equal(players.filter((p) => p.name === 'Tyty').length, 1, 'only one entry for the same clientId, not two');
    assert.equal(firstTab.connected, false, 'the replaced tab gets disconnected, not left as a ghost');
  } finally {
    server.close();
  }
});

test('an unexpected disconnect keeps the player in the roster until the grace period runs out', async () => {
  const server = await startServer({ disconnectGraceMs: 150 });
  try {
    const spectator = await server.connect();
    const flaky = await server.connect();
    const { sessionId } = await createGame(spectator, 'Maison', { clientId: 'spectator', name: 'Spec' });
    await joinGame(flaky, sessionId, { clientId: 'flaky', name: 'Flaky' });

    // Close the raw transport rather than calling disconnect() - the same
    // way a locked phone or a Wi-Fi drop looks from the server's side.
    const removedBroadcast = waitForEvent(spectator, 'players');
    flaky.io.engine.close();

    let broadcastArrived = false;
    removedBroadcast.then(() => { broadcastArrived = true; });
    await wait(80); // well under the 150ms grace period
    assert.equal(broadcastArrived, false, 'no removal broadcast while the grace period is still running');

    const players = await removedBroadcast;
    assert.equal(players.find((p) => p.name === 'Flaky'), undefined, 'removed once the grace period ran out');
  } finally {
    server.close();
  }
});

test('reconnecting during the grace period cancels the pending removal', async () => {
  const server = await startServer({ disconnectGraceMs: 150 });
  try {
    const spectator = await server.connect();
    const flaky = await server.connect({ reconnectionDelay: 10, reconnectionDelayMax: 20 });
    const { sessionId } = await createGame(spectator, 'Maison', { clientId: 'spectator', name: 'Spec' });
    await joinGame(flaky, sessionId, { clientId: 'flaky', name: 'Flaky' });

    flaky.io.engine.close();
    await waitForEvent(flaky, 'connect');
    const roster = waitForEvent(spectator, 'players');
    await joinGame(flaky, sessionId, { clientId: 'flaky', name: 'Flaky' });
    assert.ok((await roster).find((p) => p.name === 'Flaky'), 'still present right after reconnecting');

    // Past the *original* grace deadline - if the first timer hadn't been
    // cancelled on rejoin, a stray removal would show up here.
    let strayRemoval = false;
    spectator.once('players', (p) => {
      if (!p.find((x) => x.name === 'Flaky')) strayRemoval = true;
    });
    await wait(250);
    assert.equal(strayRemoval, false, 'never removed - the reconnect cancelled the original timer');
  } finally {
    server.close();
  }
});

test('leaving on purpose removes the player immediately, ignoring the grace period', async () => {
  const server = await startServer({ disconnectGraceMs: 60_000 });
  try {
    const spectator = await server.connect();
    const leaver = await server.connect();
    const { sessionId } = await createGame(spectator, 'Maison', { clientId: 'spectator', name: 'Spec' });
    await joinGame(leaver, sessionId, { clientId: 'leaver', name: 'Leaver' });

    const left = waitForEvent(spectator, 'players');
    leaver.emit('leaveSession'); // what the back button and SE DÉCONNECTER send
    assert.equal((await left).find((p) => p.name === 'Leaver'), undefined, 'removed right away');

    // Closing the app outright (a clean disconnect) is just as immediate.
    await joinGame(leaver, sessionId, { clientId: 'leaver', name: 'Leaver' });
    const gone = waitForEvent(spectator, 'players');
    leaver.disconnect();
    assert.equal((await gone).find((p) => p.name === 'Leaver'), undefined);
  } finally {
    server.close();
  }
});

test('a player without a saved colour gets a free one, and keeps a saved one that is free', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#132ed1' });

    const roster = waitForEvent(alice, 'players');
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });
    const players = await roster;
    assert.equal(players.find((p) => p.name === 'Alice').color, '#132ed1', 'saved colour kept');
    const bobColor = players.find((p) => p.name === 'Bob').color;
    assert.match(bobColor, /^#[0-9a-f]{6}$/);
    assert.notEqual(bobColor, '#132ed1');
  } finally {
    server.close();
  }
});

test('PERSONNALISER: VALIDER updates the look for everyone, but never onto a taken colour or after the start', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#132ed1' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob', color: '#117f2d' });

    const photo = `data:image/jpeg;base64,${'a'.repeat(100)}`;
    const updated = waitForEvent(alice, 'players');
    bob.emit('customize', { photo, color: '#ed54ba', hat: 'crown' });
    const bobNow = (await updated).find((p) => p.name === 'Bob');
    assert.deepEqual([bobNow.color, bobNow.hat, bobNow.photo], ['#ed54ba', 'crown', photo]);

    const refused = waitForEvent(alice, 'players');
    bob.emit('customize', { photo, color: '#132ed1', hat: 'crown' });
    assert.equal((await refused).find((p) => p.name === 'Bob').color, '#ed54ba', "Alice's colour can't be taken");

    const roles = Promise.all([waitForEvent(alice, 'role'), waitForEvent(bob, 'role')]);
    alice.emit('startGame');
    await roles;
    // The next roster broadcast Alice hears must not carry Bob's new colour:
    // if the customize were accepted, its own broadcast would be that next one.
    const nextRoster = waitForEvent(alice, 'players');
    bob.emit('customize', { photo, color: '#ef7d0d', hat: 'none' });
    await joinGame(alice, sessionId, { clientId: 'alice', name: 'Alice', color: '#132ed1' });
    assert.equal((await nextRoster).find((p) => p.name === 'Bob').color, '#ed54ba', 'look is fixed once in the game');
  } finally {
    server.close();
  }
});
