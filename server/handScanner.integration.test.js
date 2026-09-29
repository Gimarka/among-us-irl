// The hand scanner: two players holding it together switch the alert off.
// Real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, wait, act, until, startedGame } from './testSupport.js';

async function twoPlayersWithAlert(server) {
  const { phones: [alice, bob] } = await startedGame(server, ['Alice', 'Bob']);
  await act(alice, 'alertStart');
  await until(alice, (s) => s.alert.active);
  return { alice, bob };
}

test('two players holding the scanner together switch the alert off', async () => {
  const server = await startServer({ timings: { handScanMs: 60 } });
  try {
    const { alice, bob } = await twoPlayersWithAlert(server);
    await act(alice, 'handPress', { pressing: true });
    const waiting = await until(alice, (s) => s.handScanner.pressing === 1);
    assert.equal(waiting.handScanner.scanning, false, 'alone: waiting for someone else');

    await act(bob, 'handPress', { pressing: true });
    const scanning = await until(alice, (s) => s.handScanner.scanning);
    assert.ok(scanning.handScanner.remainingMs <= 60);

    const done = await until(bob, (s) => s.handScanner.completedId === 1);
    assert.deepEqual(done.handScanner.completedBy.sort(), ['alice', 'bob']);
    assert.equal(done.alert.active, false);
    assert.equal(done.handScanner.pressing, 0);
  } finally {
    server.close();
  }
});

test('letting go before the end cancels the scan, and one player alone never finishes it', async () => {
  const server = await startServer({ timings: { handScanMs: 100 } });
  try {
    const { alice, bob } = await twoPlayersWithAlert(server);
    await act(alice, 'handPress', { pressing: true });
    await act(bob, 'handPress', { pressing: true });
    await wait(40);
    await act(bob, 'handPress', { pressing: false });
    await wait(150);
    assert.equal(alice.state.handScanner.completedId, 0, 'released too early');

    bob.disconnect(); // dropping out counts as letting go too
    await wait(150);
    assert.equal(alice.state.handScanner.completedId, 0, 'one hand alone does nothing');
    assert.equal(alice.state.alert.active, true);
  } finally {
    server.close();
  }
});
