// The alert and interference: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, act, until, joinGame, startedGame } from './testSupport.js';

test('the alert reaches every phone in the game, and a phone joining mid-alert sees it', async () => {
  const server = await startServer();
  try {
    const { phones: [alice, bob], gameId } = await startedGame(server, ['Alice', 'Bob']);
    await act(bob, 'alertStart');
    await Promise.all([alice, bob].map((phone) => until(phone, (s) => s.alert.active)));

    const carol = await server.connect();
    const { state } = await joinGame(carol, gameId, { clientId: 'carol', name: 'Carol' });
    assert.equal(state.alert.active, true);

    await act(alice, 'alertStop');
    await Promise.all([alice, bob, carol].map((phone) => until(phone, (s) => !s.alert.active)));
  } finally {
    server.close();
  }
});

test('the countdown is shared, and the server itself ends the alert when it runs out', async () => {
  const server = await startServer({ timings: { alertMs: 150 } });
  try {
    const { phones: [alice, bob] } = await startedGame(server, ['Alice', 'Bob']);
    await act(alice, 'alertStart');
    const [fromAlice, fromBob] = await Promise.all([alice, bob].map((phone) => until(phone, (s) => s.alert.active)));
    for (const { alert } of [fromAlice, fromBob]) {
      assert.equal(alert.durationMs, 150);
      assert.ok(alert.remainingMs > 0 && alert.remainingMs <= 150);
    }
    await Promise.all([alice, bob].map((phone) => until(phone, (s) => !s.alert.active, 1000)));
  } finally {
    server.close();
  }
});

test('interference reaches every phone in the game and ends on its own', async () => {
  const server = await startServer({ timings: { interferenceMs: 100 } });
  try {
    const { phones: [alice, bob] } = await startedGame(server, ['Alice', 'Bob']);
    await act(alice, 'interferenceStart');
    await Promise.all([alice, bob].map((phone) => until(phone, (s) => s.interference.active)));
    await Promise.all([alice, bob].map((phone) => until(phone, (s) => !s.interference.active, 1000)));
  } finally {
    server.close();
  }
});
