// The surveillance feed. Real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, act, until, joinGame, startedGame } from './testSupport.js';

test('players see each other\'s doors, minigames and tasks, but never the alert', async () => {
  const server = await startServer();
  try {
    const { phones: [alice, bob] } = await startedGame(server, ['Alice', 'Bob']);
    await act(bob, 'reportAction', { action: 'door' });
    const [entry] = (await until(alice, (s) => s.activity.length === 1)).activity;
    assert.deepEqual([entry.name, entry.action], ['Bob', 'door']);
    assert.ok(entry.agoMs >= 0);

    assert.equal((await act(bob, 'reportAction', { action: 'alertStart' })).ok, false, 'not something the feed shows');
    await act(alice, 'completeRandomTask');
    const { activity } = await until(bob, (s) => s.activity.length === 2);
    assert.deepEqual(activity.map((item) => `${item.name} ${item.action}`), ['Bob door', 'Alice task']);
    assert.ok(activity[1].detail, 'which task');
  } finally {
    server.close();
  }
});

test('only the last few actions are kept, and a newcomer in the lobby sees none', async () => {
  const server = await startServer();
  try {
    const { phones: [alice], gameId } = await startedGame(server, ['Alice']);
    for (let i = 0; i < 8; i += 1) await act(alice, 'reportAction', { action: 'dino' });
    const { activity } = await until(alice, (s) => s.activity.at(-1)?.id === 8);
    assert.equal(activity.length, 5);

    const bob = await server.connect();
    const { state } = await joinGame(bob, gameId, { clientId: 'bob', name: 'Bob' });
    assert.deepEqual(state.activity, []);
  } finally {
    server.close();
  }
});
