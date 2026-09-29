// A game's alert and its countdown: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, createGame, joinGame } from './testSupport.js';

test('alertStart/alertStop reach every phone in the game, and a phone joining mid-alert sees it', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });

    const bothStarted = Promise.all([waitForEvent(alice, 'alert'), waitForEvent(bob, 'alert')]);
    alice.emit('alertStart');
    const [aliceStart, bobStart] = await bothStarted;
    assert.equal(aliceStart.active, true);
    assert.equal(bobStart.active, true);

    const carol = await server.connect();
    const carolInitial = waitForEvent(carol, 'alert');
    await joinGame(carol, sessionId, { clientId: 'carol', name: 'Carol' });
    assert.equal((await carolInitial).active, true);

    const bothStopped = Promise.all([waitForEvent(alice, 'alert'), waitForEvent(bob, 'alert')]);
    bob.emit('alertStop');
    const [aliceStop, bobStop] = await bothStopped;
    assert.equal(aliceStop.active, false);
    assert.equal(bobStop.active, false);
  } finally {
    server.close();
  }
});

test('the countdown is shared, and the server itself ends the alert when it runs out', async () => {
  const server = await startServer({ alertCountdownMs: 60 });
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });

    const bothStarted = Promise.all([waitForEvent(alice, 'alert'), waitForEvent(bob, 'alert')]);
    alice.emit('alertStart');
    const [aliceStart, bobStart] = await bothStarted;
    assert.equal(aliceStart.durationMs, 60);
    assert.ok(aliceStart.remainingMs > 0 && aliceStart.remainingMs <= 60);
    assert.ok(bobStart.remainingMs > 0);

    // No one presses anything: the server's own timer ends it for everyone.
    const [aliceEnd, bobEnd] = await Promise.all([waitForEvent(alice, 'alert'), waitForEvent(bob, 'alert')]);
    assert.equal(aliceEnd.active, false, 'the alert ends with the bar');
    assert.equal(bobEnd.active, false);
    assert.equal(aliceEnd.remainingMs, 0);
  } finally {
    server.close();
  }
});
