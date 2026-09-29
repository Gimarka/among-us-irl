// The surveillance log. Real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, createGame, joinGame } from './testSupport.js';

test('players see each other\'s actions live, only the latest one on opening, and never the alert', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    const bob = await server.connect();
    const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });
    const roles = [waitForEvent(alice, 'role'), waitForEvent(bob, 'role')];
    alice.emit('startGame');
    await Promise.all(roles);

    const live = waitForEvent(alice, 'activity');
    bob.emit('reportAction', { action: 'door' });
    const entry = await live;
    assert.equal(entry.name, 'Bob');
    assert.equal(entry.action, 'door');

    bob.emit('reportAction', { action: 'alertStart' }); // not something the screen shows
    const task = waitForEvent(alice, 'activity');
    alice.emit('completeRandomTask');
    assert.equal((await task).action, 'task');

    const history = await alice.emitWithAck('getActivity');
    assert.deepEqual(history.map((item) => `${item.name} ${item.action}`), ['Alice task'], 'no older history');
  } finally {
    server.close();
  }
});
