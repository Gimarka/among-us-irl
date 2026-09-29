// Phones joining a game and its roster: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, waitForEvent, wait, createGame, joinGame, leaveGame, act, until, lobbyOf, startedGame, playerNamed,
} from './testSupport.js';

test('two players in the same game see each other in the players list', async () => {
  const server = await startServer();
  try {
    const { phones: [alice, bob] } = await lobbyOf(server, ['Alice', 'Bob']);
    for (const phone of [alice, bob]) {
      const state = await until(phone, (s) => s.players.length === 2);
      assert.deepEqual(state.players.map((p) => p.name).sort(), ['Alice', 'Bob']);
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
    const created = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#38FEDC', hat: 'crown' });
    const { state } = await joinGame(bob, created.state.game.id, { clientId: 'bob', name: 'Bob', color: 'javascript:alert(1)', hat: '<script>' });

    assert.equal(playerNamed(state, 'Alice').color, '#38fedc');
    assert.equal(playerNamed(state, 'Alice').hat, 'crown');
    assert.match(playerNamed(state, 'Bob').color, /^#[0-9a-f]{6}$/, 'bad colour replaced by a real one');
    assert.notEqual(playerNamed(state, 'Bob').color, '#38fedc', 'and not one already taken');
    assert.equal(playerNamed(state, 'Bob').hat, 'none', 'bad hat falls back');
  } finally {
    server.close();
  }
});

test('colours are unique within a game, but two games can use the same one', async () => {
  const server = await startServer();
  try {
    const [alice, bob, carol] = [await server.connect(), await server.connect(), await server.connect()];
    const created = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#c51111' });
    const { state } = await joinGame(bob, created.state.game.id, { clientId: 'bob', name: 'Bob', color: '#c51111' });
    assert.equal(playerNamed(state, 'Alice').color, '#c51111');
    assert.notEqual(playerNamed(state, 'Bob').color, '#c51111', 'taken in this game');

    const other = await createGame(carol, 'Jardin', { clientId: 'carol', name: 'Carol', color: '#c51111' });
    assert.equal(other.state.players[0].color, '#c51111', 'free in a different game');
  } finally {
    server.close();
  }
});

test('a player without a saved colour gets a free one, and a reconnecting player keeps theirs', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const created = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#132ed1' });
    const { state } = await joinGame(bob, created.state.game.id, { clientId: 'bob', name: 'Bob' });
    assert.equal(playerNamed(state, 'Alice').color, '#132ed1', 'saved colour kept');
    assert.match(playerNamed(state, 'Bob').color, /^#[0-9a-f]{6}$/);
    assert.notEqual(playerNamed(state, 'Bob').color, '#132ed1');

    const again = await joinGame(alice, created.state.game.id, { clientId: 'alice', name: 'Alice', color: '#132ed1' });
    assert.equal(again.state.players.length, 2, 'no duplicate');
    assert.equal(playerNamed(again.state, 'Alice').color, '#132ed1', 'not bumped off their own colour');
  } finally {
    server.close();
  }
});

test('selfies are loaded from their own address, never sent inside the state; an oversized one is dropped', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const photo = `data:image/jpeg;base64,${Buffer.from('fake jpeg').toString('base64')}`;
    const created = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', photo });
    const { state } = await joinGame(bob, created.state.game.id, {
      clientId: 'bob', name: 'Bob', photo: `data:image/jpeg;base64,${'a'.repeat(200_000)}`,
    });

    const address = playerNamed(state, 'Alice').photo;
    assert.match(address, /^\/photos\/alice\?v=\d+$/);
    assert.ok(!JSON.stringify(state).includes('base64'), 'no photo data in the state');
    const response = await fetch(`${server.url}${address}`);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(await response.text(), 'fake jpeg');
    assert.equal(playerNamed(state, 'Bob').photo, null, 'oversized photo dropped, player still joins');

    // Coming back without sending the photo again keeps it.
    const again = await joinGame(alice, created.state.game.id, { clientId: 'alice', name: 'Alice' });
    assert.equal(playerNamed(again.state, 'Alice').photo, address);
  } finally {
    server.close();
  }
});

test('the same clientId joining from a second tab replaces the old connection instead of duplicating', async () => {
  const server = await startServer();
  try {
    const { phones: [spectator], gameId } = await lobbyOf(server, ['Spec']);
    const firstTab = await server.connect();
    await joinGame(firstTab, gameId, { clientId: 'same-browser', name: 'Tyty' });

    const secondTab = await server.connect();
    const firstTabClosed = waitForEvent(firstTab, 'disconnect');
    await joinGame(secondTab, gameId, { clientId: 'same-browser', name: 'Tyty' });
    await firstTabClosed;
    const state = await until(spectator, (s) => s.players.length === 2);

    assert.equal(state.players.filter((p) => p.name === 'Tyty').length, 1, 'one entry for the same clientId');
    assert.equal(playerNamed(state, 'Tyty').online, true, 'the new tab counts, not the closed one');
    assert.equal(firstTab.connected, false, 'the replaced tab is disconnected, not left as a ghost');
  } finally {
    server.close();
  }
});

test('a dropped connection shows the player offline, and removes them only once the grace period runs out', async () => {
  const server = await startServer({ disconnectGraceMs: 200 });
  try {
    const { phones: [spectator, flaky] } = await lobbyOf(server, ['Spec', 'Flaky']);

    // Close the raw transport rather than calling disconnect() - the same
    // way a locked phone or a Wi-Fi drop looks from the server's side.
    flaky.io.engine.close();
    const offline = await until(spectator, (s) => playerNamed(s, 'Flaky')?.online === false);
    assert.ok(offline, 'still in the game, shown offline');

    await until(spectator, (s) => !playerNamed(s, 'Flaky'), 1000);
  } finally {
    server.close();
  }
});

test('coming back during the grace period cancels the removal and shows the player online again', async () => {
  const server = await startServer({ disconnectGraceMs: 150 });
  try {
    const { phones: [spectator], gameId } = await lobbyOf(server, ['Spec']);
    const flaky = await server.connect({ reconnectionDelay: 10, reconnectionDelayMax: 20 });
    await joinGame(flaky, gameId, { clientId: 'flaky', name: 'Flaky' });

    flaky.io.engine.close();
    await until(spectator, (s) => playerNamed(s, 'Flaky')?.online === false);
    await waitForEvent(flaky, 'connect');
    await joinGame(flaky, gameId, { clientId: 'flaky', name: 'Flaky' });
    await until(spectator, (s) => playerNamed(s, 'Flaky')?.online === true);

    // Past the original deadline: a timer that wasn't cancelled would show here.
    await wait(250);
    assert.ok(playerNamed(spectator.state, 'Flaky'), 'never removed');
  } finally {
    server.close();
  }
});

test('leaving on purpose removes the player immediately, ignoring the grace period', async () => {
  const server = await startServer({ disconnectGraceMs: 60_000 });
  try {
    const { phones: [spectator, leaver], gameId } = await lobbyOf(server, ['Spec', 'Leaver']);

    await leaveGame(leaver); // what the back button and SE DÉCONNECTER send
    await until(spectator, (s) => !playerNamed(s, 'Leaver'));

    // Closing the app outright (a clean disconnect) is just as immediate.
    await joinGame(leaver, gameId, { clientId: 'leaver', name: 'Leaver' });
    await until(spectator, (s) => Boolean(playerNamed(s, 'Leaver')));
    leaver.disconnect();
    await until(spectator, (s) => !playerNamed(s, 'Leaver'));
  } finally {
    server.close();
  }
});

test('PERSONNALISER: VALIDER updates the look for everyone, but never onto a taken colour or after the start', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const created = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice', color: '#132ed1' });
    const gameId = created.state.game.id;
    await joinGame(bob, gameId, { clientId: 'bob', name: 'Bob', color: '#117f2d' });

    const photo = `data:image/jpeg;base64,${'a'.repeat(100)}`;
    await act(bob, 'customize', { photo, color: '#ed54ba', hat: 'crown' });
    const updated = await until(alice, (s) => playerNamed(s, 'Bob').hat === 'crown');
    assert.equal(playerNamed(updated, 'Bob').color, '#ed54ba');
    assert.match(playerNamed(updated, 'Bob').photo, /^\/photos\/bob\?v=\d+$/);

    await act(bob, 'customize', { photo, color: '#132ed1', hat: 'crown' });
    assert.equal(playerNamed(alice.state, 'Bob').color, '#ed54ba', "Alice's colour can't be taken");

    await act(alice, 'start');
    const refused = await act(bob, 'customize', { photo, color: '#ef7d0d', hat: 'none' });
    assert.equal(refused.ok, false, 'look is fixed once in the game');
    assert.equal(playerNamed(alice.state, 'Bob').color, '#ed54ba');
  } finally {
    server.close();
  }
});

test('a phone is only sent a state when its own view changed, and versions only go up', async () => {
  const server = await startServer();
  try {
    const { phones: [alice, bob] } = await startedGame(server, ['Alice', 'Bob']);
    await wait(50);
    const bobBefore = bob.states.length;
    const aliceBefore = alice.states.length;
    await act(alice, 'completeTask', { taskId: alice.state.me.tasks[0].id });
    await until(alice, (s) => s.me.tasks[0].done);
    await wait(50);
    assert.equal(bob.states.length, bobBefore, "Alice's own tasks don't concern Bob's phone");
    assert.equal(alice.states.length, aliceBefore + 1);

    const versions = alice.states.map((s) => s.version);
    assert.deepEqual(versions, [...versions].sort((a, b) => a - b));
  } finally {
    server.close();
  }
});
