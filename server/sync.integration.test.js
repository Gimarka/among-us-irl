// Staying in sync through bad connections. Real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, act, until, joinGame, startedGame } from './testSupport.js';

test('an action sent again after a reconnect (same id) is only done once', async () => {
  const server = await startServer();
  try {
    const { phones: [alice] } = await startedGame(server, ['Alice']);
    const action = { id: 'alice-1', type: 'completeRandomTask' };
    assert.deepEqual(await alice.emitWithAck('act', action), { ok: true });
    assert.deepEqual(await alice.emitWithAck('act', action), { ok: true, repeat: true });
    const { me } = await until(alice, (s) => s.me.tasks.some((task) => task.done));
    assert.equal(me.tasks.filter((task) => task.done).length, 1);

    await alice.emitWithAck('act', { id: 'alice-2', type: 'completeRandomTask' });
    await until(alice, (s) => s.me.tasks.filter((task) => task.done).length === 2);
  } finally {
    server.close();
  }
});

test('a phone that reconnects gets the whole game as it is now, whatever it missed', async () => {
  const server = await startServer({ timings: { reportMs: 5000 } });
  try {
    const { phones: [alice], gameId } = await startedGame(server, ['Alice', 'Bob']);
    const bob = await server.connect({ reconnectionDelay: 10, reconnectionDelayMax: 20 });
    await joinGame(bob, gameId, { clientId: 'bob', name: 'Bob' });

    bob.io.engine.close();
    await until(alice, (s) => s.players.find((p) => p.id === 'bob').online === false);
    await act(alice, 'chat', { text: 'tu es là ?' });
    await act(alice, 'reportBody');

    await waitForEvent(bob, 'connect');
    const { state } = await joinGame(bob, gameId, { clientId: 'bob', name: 'Bob' });
    assert.equal(state.meeting.step, 'report');
    assert.equal(state.chatLastId, 1);
    await until(alice, (s) => s.players.find((p) => p.id === 'bob').online === true);
  } finally {
    server.close();
  }
});

test('a phone checking its connection gets an answer', async () => {
  const server = await startServer();
  try {
    const phone = await server.connect();
    assert.equal(await phone.timeout(1000).emitWithAck('stillThere'), true);
  } finally {
    server.close();
  }
});
