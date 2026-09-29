// Named games side by side, the host, and coming back to a game: real HTTP
// server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer, waitForEvent, wait, hello, createGame, joinGame, leaveGame, act, until, lobbyOf, startedGame,
} from './testSupport.js';

test('NOUVELLE PARTIE creates a named game with its creator as host, listed for everyone', async () => {
  const server = await startServer();
  try {
    const browsing = await server.connect(); // a phone sitting on the character screen
    const alice = await server.connect();
    const listed = new Promise((resolve) => {
      browsing.on('sessions', (list) => { if (list.length) resolve(list); });
    });
    const { state } = await createGame(alice, '  Soirée  ', { clientId: 'alice', name: 'Alice' });
    assert.deepEqual([state.game.name, state.game.hostId, state.game.started], ['Soirée', 'alice', false]);
    assert.equal(state.me.member, false, 'a new game starts in its lobby');

    const [game] = await listed;
    assert.deepEqual(game, { id: state.game.id, name: 'Soirée', playerCount: 1, started: false });
  } finally {
    server.close();
  }
});

test('a game name must be non-empty and not already used by a running game', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    await createGame(alice, 'Soirée', { clientId: 'alice', name: 'Alice' });

    assert.equal((await createGame(bob, 'SOIRÉE', { clientId: 'bob', name: 'Bob' })).error, 'name-taken', 'ignoring case');
    assert.equal((await createGame(bob, '   ', { clientId: 'bob', name: 'Bob' })).error, 'name-empty');
    assert.equal((await joinGame(bob, 9999, { clientId: 'bob', name: 'Bob' })).error, 'not-found');
  } finally {
    server.close();
  }
});

test('two games are fully separate: chat, alert and roster stay in their own game', async () => {
  const server = await startServer();
  try {
    const { phones: [alice] } = await startedGame(server, ['Alice'], 'Maison');
    const { phones: [bob] } = await startedGame(server, ['Bob'], 'Jardin');
    await wait(50);
    const bobBefore = bob.states.length;

    await act(alice, 'chat', { text: 'salut' });
    await act(alice, 'alertStart');
    await until(alice, (s) => s.alert.active && s.chatLastId === 1);
    await wait(50);
    assert.equal(bob.states.length, bobBefore, 'nothing from the other game reaches Bob');
    assert.equal(bob.state.alert.active, false);
    assert.equal(bob.state.chatLastId, 0);
  } finally {
    server.close();
  }
});

test('when the host leaves, the longest-present player becomes host', async () => {
  const server = await startServer();
  try {
    const { phones: [alice, bob, carol] } = await lobbyOf(server, ['Alice', 'Bob', 'Carol']);
    await leaveGame(alice);
    await until(carol, (s) => s.game.hostId === 'bob');

    assert.equal((await act(carol, 'start')).ok, false, 'still only the host starts');
    assert.equal((await act(bob, 'start')).ok, true);
    await until(carol, (s) => s.me.member);
  } finally {
    server.close();
  }
});

test('a game already started stays joinable: newcomers wait in the lobby, then CONTINUER as crewmate', async () => {
  const server = await startServer();
  try {
    const { phones: [alice], gameId } = await startedGame(server, ['Alice']);
    const bob = await server.connect();
    const shownStarted = new Promise((resolve) => {
      bob.on('sessions', (list) => { if (list[0]?.started) resolve(list); });
    });
    bob.emit('hello', { clientId: 'bob' });
    await Promise.race([shownStarted, until(alice, (s) => s.game.started)]);

    const { state } = await joinGame(bob, gameId, { clientId: 'bob', name: 'Bob' });
    assert.equal(state.game.started, true);
    assert.equal(state.me.member, false, 'a newcomer goes to the lobby first');

    await act(bob, 'start');
    const playing = await until(bob, (s) => s.me.member);
    assert.equal(playing.me.role, 'crewmate');
    assert.equal(playing.me.roleSeen, false, 'the reveal plays for them');
  } finally {
    server.close();
  }
});

test('coming back: a player keeps their game after leaving it once started, but not a lobby', async () => {
  const server = await startServer();
  try {
    const { phones: [alice, bob], gameId } = await lobbyOf(server, ['Alice', 'Bob']);

    // Bob leaves the lobby before the start: no game to come back to.
    await leaveGame(bob);
    assert.equal((await hello(bob, 'bob')).resume, null);

    await joinGame(bob, gameId, { clientId: 'bob', name: 'Bob' });
    await act(alice, 'start');
    await until(bob, (s) => s.me.member);
    await act(bob, 'roleSeen');
    const tasksAtStart = (await until(bob, (s) => s.me.roleSeen)).me.tasks;

    // Bob leaves the started game: still his, same tasks, no second reveal.
    await leaveGame(bob);
    const welcome = await hello(bob, 'bob');
    assert.deepEqual(welcome.resume, { sessionId: gameId, inGame: true });
    assert.equal(welcome.character.name, 'Bob');

    const { state } = await joinGame(bob, gameId, { clientId: 'bob', name: 'Bob' });
    assert.equal(state.me.member, true, 'straight back to the main menu');
    assert.equal(state.me.roleSeen, true, 'no second reveal');
    assert.deepEqual(state.me.tasks, tasksAtStart);
  } finally {
    server.close();
  }
});

test('a game is deleted once its last player leaves, but characters are kept', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    const emptied = new Promise((resolve) => {
      alice.on('sessions', (list) => { if (list.length === 0) resolve(list); });
    });
    await leaveGame(alice);
    await emptied;

    const welcome = await hello(alice, 'alice');
    assert.equal(welcome.resume, null);
    assert.equal(welcome.character.name, 'Alice');
    assert.equal((await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' })).ok, true, 'the name is free again');
  } finally {
    server.close();
  }
});

test('a lobby player whose phone was asleep at JOUER gets the full game, and their reveal, when they come back', async () => {
  const server = await startServer({ disconnectGraceMs: 5000 });
  try {
    const { phones: [alice, bob], gameId } = await lobbyOf(server, ['Alice', 'Bob']);
    bob.io.engine.close(); // drops without leaving - stays in the lobby roster
    await until(alice, (s) => s.players.find((p) => p.id === 'bob')?.online === false);
    await act(alice, 'start');
    await act(alice, 'roleSeen');
    await act(alice, 'alertStart'); // something else happens while Bob is away

    const bobAgain = await server.connect();
    assert.deepEqual((await hello(bobAgain, 'bob')).resume, { sessionId: gameId, inGame: true });
    const { state } = await joinGame(bobAgain, gameId, { clientId: 'bob', name: 'Bob' });
    assert.equal(state.me.member, true);
    assert.equal(state.me.roleSeen, false, 'the reveal still to play');
    assert.ok(['crewmate', 'imposter'].includes(state.me.role));
    assert.equal(state.alert.active, true, 'and everything that happened meanwhile');
  } finally {
    server.close();
  }
});

test('the vote, tasks and chat are refused outside the phases they belong to', async () => {
  const server = await startServer({ timings: { reportMs: 30, voteMs: 5000 } });
  try {
    const { phones: [alice, bob] } = await lobbyOf(server, ['Alice', 'Bob']);
    assert.equal((await act(alice, 'alertStart')).error, 'not-allowed', 'nothing but the lobby before JOUER');
    assert.equal((await act(alice, 'castVote', { targetId: 'bob' })).error, 'not-allowed');

    await act(alice, 'start');
    await until(bob, (s) => s.me.member);
    assert.equal((await act(bob, 'updateSettings', { imposterCount: 2 })).ok, false);
    assert.equal((await act(alice, 'bogus')).error, 'unknown-action');

    await act(alice, 'reportBody');
    await until(alice, (s) => s.meeting?.step === 'vote');
    for (const type of ['completeRandomTask', 'chat', 'alertStart', 'interferenceStart', 'reportBody']) {
      assert.equal((await act(alice, type, { text: 'hé' })).ok, false, `${type} during the vote`);
    }
    assert.equal((await act(alice, 'handPress', { pressing: true })).ok, false);
  } finally {
    server.close();
  }
});
