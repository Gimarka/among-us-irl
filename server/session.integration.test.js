// Named games side by side, played with fake players: real HTTP server,
// real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, wait, hello, createGame, joinGame } from './testSupport.js';

test('NOUVELLE PARTIE creates a named game with its creator as host, listed for everyone', async () => {
  const server = await startServer();
  try {
    const browsing = await server.connect(); // a phone sitting on the character screen
    const alice = await server.connect();

    const listed = waitForEvent(browsing, 'sessions');
    const joined = await createGame(alice, '  Soirée  ', { clientId: 'alice', name: 'Alice' });
    assert.equal(joined.name, 'Soirée');
    assert.equal(joined.hostId, 'alice');
    assert.equal(joined.started, false);
    assert.equal(joined.inGame, false, 'a new game starts in its lobby');

    const [game] = await listed;
    assert.deepEqual(game, { id: joined.sessionId, name: 'Soirée', playerCount: 1, started: false });
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

    const taken = waitForEvent(bob, 'sessionError');
    bob.emit('createSession', { clientId: 'bob', name: 'Bob', sessionName: 'SOIRÉE' });
    assert.equal((await taken).reason, 'name-taken', 'ignoring upper/lower case');

    const empty = waitForEvent(bob, 'sessionError');
    bob.emit('createSession', { clientId: 'bob', name: 'Bob', sessionName: '   ' });
    assert.equal((await empty).reason, 'name-empty');

    const gone = waitForEvent(bob, 'sessionError');
    bob.emit('joinSession', { clientId: 'bob', name: 'Bob', sessionId: 9999 });
    assert.equal((await gone).reason, 'not-found');
  } finally {
    server.close();
  }
});

test('two games are fully separate: chat, alert and roster stay in their own game', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    await createGame(bob, 'Jardin', { clientId: 'bob', name: 'Bob' });

    const leaked = [];
    bob.on('chatMessage', () => leaked.push('chat'));
    bob.on('alert', () => leaked.push('alert'));
    bob.on('players', () => leaked.push('players'));

    const own = waitForEvent(alice, 'alert');
    alice.emit('chatMessage', { text: 'salut' });
    alice.emit('alertStart');
    await own;
    await hello(bob, 'bob');
    assert.deepEqual(leaked, []);
  } finally {
    server.close();
  }
});

test('when the host leaves, the longest-present player becomes host', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const carol = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });
    await joinGame(carol, sessionId, { clientId: 'carol', name: 'Carol' });

    const newHost = waitForEvent(carol, 'session');
    alice.emit('leaveSession');
    assert.equal((await newHost).hostId, 'bob');

    const roles = Promise.all([waitForEvent(bob, 'role'), waitForEvent(carol, 'role')]);
    bob.emit('startGame');
    await roles;
  } finally {
    server.close();
  }
});

test('a game already started stays joinable: newcomers wait in the lobby, then CONTINUER as crewmate', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    // The list is pushed on every change; wait for the one where it has started.
    const shownStarted = new Promise((resolve) => {
      bob.on('sessions', (list) => { if (list[0]?.started) resolve(list); });
    });
    const aliceRole = waitForEvent(alice, 'role');
    alice.emit('startGame');
    await aliceRole;
    await shownStarted; // times out (fails) if the list never shows it as started

    const joined = await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });
    assert.equal(joined.started, true);
    assert.equal(joined.inGame, false, 'a newcomer goes to the lobby first');

    const bobRole = waitForEvent(bob, 'role');
    bob.emit('startGame');
    assert.equal((await bobRole).role, 'crewmate');
  } finally {
    server.close();
  }
});

test('coming back: a player keeps their game after leaving it once started, but not a lobby', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });

    // Bob leaves the lobby before the start: no game to come back to.
    bob.emit('leaveSession');
    assert.equal((await hello(bob, 'bob')).resume, null);
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });

    const roles = Promise.all([waitForEvent(alice, 'role'), waitForEvent(bob, 'role')]);
    alice.emit('startGame');
    const [, bobStart] = await roles;

    // Bob leaves the started game: still his, with the same tasks and no second reveal.
    bob.emit('leaveSession');
    const welcome = await hello(bob, 'bob');
    assert.deepEqual(welcome.resume, { sessionId, inGame: true });
    assert.equal(welcome.character.name, 'Bob');

    let revealedAgain = false;
    bob.on('role', () => { revealedAgain = true; });
    const resumedTasks = waitForEvent(bob, 'tasks');
    const rejoined = await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });
    assert.equal(rejoined.inGame, true, 'straight back to the main menu');
    assert.deepEqual(await resumedTasks, bobStart.tasks);
    assert.equal(revealedAgain, false);
  } finally {
    server.close();
  }
});

test('a game is deleted once its last player leaves, but characters are kept', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });

    const emptied = waitForEvent(alice, 'sessions');
    alice.emit('leaveSession');
    assert.deepEqual(await emptied, []);

    const welcome = await hello(alice, 'alice');
    assert.equal(welcome.resume, null);
    assert.equal(welcome.character.name, 'Alice');

    // The name is free again.
    const again = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    assert.equal(again.name, 'Maison');
  } finally {
    server.close();
  }
});

test('a lobby player whose phone was asleep at JOUER gets their reveal when they reconnect', async () => {
  const server = await startServer({ disconnectGraceMs: 5000 });
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });

    // Bob's connection drops without him leaving - he stays in the lobby roster.
    bob.io.engine.close();
    await wait(50);

    const aliceRole = waitForEvent(alice, 'role');
    alice.emit('startGame');
    await aliceRole;

    const bobAgain = await server.connect();
    assert.deepEqual((await hello(bobAgain, 'bob')).resume, { sessionId, inGame: true });
    const bobRole = waitForEvent(bobAgain, 'role');
    await joinGame(bobAgain, sessionId, { clientId: 'bob', name: 'Bob' });
    const { role } = await bobRole;
    assert.ok(role === 'crewmate' || role === 'imposter');
  } finally {
    server.close();
  }
});

test('a player whose phone never confirmed the role reveal gets it again instead of staying in the lobby', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });

    // Bob's phone receives nothing usable: a connection that looks alive to
    // the server but never answers.
    bob.off('role');
    const bobGotIt = waitForEvent(bob, 'role');
    const aliceRole = waitForEvent(alice, 'role');
    alice.emit('startGame');
    await Promise.all([aliceRole, bobGotIt]);

    // Back on a fresh connection: the reveal is sent again.
    const bobAgain = await server.connect();
    const again = waitForEvent(bobAgain, 'role');
    const joined = await joinGame(bobAgain, sessionId, { clientId: 'bob', name: 'Bob' });
    assert.equal(joined.inGame, true);
    const { role } = await again;
    assert.ok(role === 'crewmate' || role === 'imposter');
  } finally {
    server.close();
  }
});
