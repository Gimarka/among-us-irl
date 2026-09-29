// A game's interference reaching all its phones and auto-expiring: real
// HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, createGame, joinGame } from './testSupport.js';

test('interferenceStart reaches every phone in the game and auto-expires on its own', async () => {
  const server = await startServer({ interferenceDurationMs: 40 });
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });

    const bothStarted = Promise.all([waitForEvent(alice, 'interference'), waitForEvent(bob, 'interference')]);
    alice.emit('interferenceStart');
    const [aliceStart, bobStart] = await bothStarted;
    assert.equal(aliceStart.active, true);
    assert.equal(bobStart.active, true);

    const [aliceEnd, bobEnd] = await Promise.all([waitForEvent(alice, 'interference'), waitForEvent(bob, 'interference')]);
    assert.equal(aliceEnd.active, false, 'must turn itself off without a second button press');
    assert.equal(bobEnd.active, false);
  } finally {
    server.close();
  }
});
