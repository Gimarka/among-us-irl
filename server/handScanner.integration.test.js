// The hand scanner: two players holding it together switch the alert off.
// Real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, wait, createGame, joinGame } from './testSupport.js';

async function twoPlayersWithAlert(server) {
  const alice = await server.connect();
  const bob = await server.connect();
  const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
  await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });
  const on = waitForEvent(alice, 'alert');
  alice.emit('alertStart');
  await on;
  return { alice, bob };
}

test('two players holding the scanner together switch the alert off', async () => {
  const server = await startServer({ handScanMs: 60 });
  try {
    const { alice, bob } = await twoPlayersWithAlert(server);
    const waiting = waitForEvent(alice, 'handScanner');
    alice.emit('handPress', { pressing: true });
    assert.deepEqual(await waiting, { pressing: 1, scanning: false, scanMs: 60 }, 'alone: waiting for someone else');

    const done = Promise.all([waitForEvent(alice, 'handScanComplete'), waitForEvent(bob, 'alert')]);
    bob.emit('handPress', { pressing: true });
    const [{ players }, alert] = await done;
    assert.deepEqual(players.sort(), ['alice', 'bob']);
    assert.equal(alert.active, false);
  } finally {
    server.close();
  }
});

test('letting go before the end cancels the scan, and one player alone never finishes it', async () => {
  const server = await startServer({ handScanMs: 100 });
  try {
    const { alice, bob } = await twoPlayersWithAlert(server);
    let completed = false;
    alice.on('handScanComplete', () => { completed = true; });

    alice.emit('handPress', { pressing: true });
    bob.emit('handPress', { pressing: true });
    await wait(40);
    bob.emit('handPress', { pressing: false });
    await wait(150);
    assert.equal(completed, false, 'released too early');

    bob.disconnect(); // dropping out counts as letting go too
    await wait(150);
    assert.equal(completed, false, 'one hand alone does nothing');
  } finally {
    server.close();
  }
});
