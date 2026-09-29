// The host's ⚙️ settings, and the game actually using them: real HTTP
// server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, hello, createGame, joinGame } from './testSupport.js';

async function lobby(server, count) {
  const phones = [];
  for (let i = 0; i < count; i += 1) phones.push(await server.connect());
  const { sessionId } = await createGame(phones[0], 'Maison', { clientId: 'p0', name: 'P0' });
  for (let i = 1; i < count; i += 1) await joinGame(phones[i], sessionId, { clientId: `p${i}`, name: `P${i}` });
  return { phones, sessionId };
}

test('only the host can change the settings, only before JOUER, and everyone hears them', async () => {
  const server = await startServer();
  try {
    const { phones: [host, guest] } = await lobby(server, 2);

    let guestChanged = false;
    host.on('session', (info) => { if (info.settings.imposterCount === 3) guestChanged = true; });
    guest.emit('updateSettings', { imposterCount: 3 });
    await hello(guest, 'p1');
    assert.equal(guestChanged, false, 'a guest cannot change them');

    const heard = waitForEvent(guest, 'session');
    host.emit('updateSettings', { imposterCount: 2, tasksPerPlayer: 4, alertSeconds: 30, interferenceSeconds: 20 });
    assert.deepEqual((await heard).settings, { imposterCount: 2, tasksPerPlayer: 4, alertSeconds: 30, interferenceSeconds: 20 });

    const roles = Promise.all([waitForEvent(host, 'role'), waitForEvent(guest, 'role')]);
    host.emit('startGame');
    await roles;
    let changedAfterStart = false;
    guest.on('session', () => { changedAfterStart = true; });
    host.emit('updateSettings', { imposterCount: 1 });
    await hello(host, 'p0');
    assert.equal(changedAfterStart, false, 'fixed once the game has started');
  } finally {
    server.close();
  }
});

test('JOUER draws the chosen number of imposters and tasks', async () => {
  const server = await startServer();
  try {
    const { phones } = await lobby(server, 5);
    const set = waitForEvent(phones[1], 'session');
    phones[0].emit('updateSettings', { imposterCount: 2, tasksPerPlayer: 3 });
    await set;

    const roles = Promise.all(phones.map((phone) => waitForEvent(phone, 'role')));
    phones[0].emit('startGame');
    const started = await roles;
    assert.equal(started.filter(({ role }) => role === 'imposter').length, 2);
    started.forEach(({ tasks }) => assert.equal(tasks.length, 3));
  } finally {
    server.close();
  }
});

test('the alert countdown and the interference last as long as the settings say', async () => {
  const server = await startServer();
  try {
    const { phones: [host] } = await lobby(server, 1);
    const set = waitForEvent(host, 'session');
    host.emit('updateSettings', { alertSeconds: 15, interferenceSeconds: 5 });
    await set;

    const alert = waitForEvent(host, 'alert');
    host.emit('alertStart');
    const { durationMs, remainingMs } = await alert;
    assert.equal(durationMs, 15_000);
    assert.ok(remainingMs > 14_000 && remainingMs <= 15_000);

    const on = waitForEvent(host, 'interference');
    host.emit('interferenceStart');
    await on;
    const startedAt = Date.now();
    const off = await waitForEvent(host, 'interference');
    assert.equal(off.active, false);
    const lasted = Date.now() - startedAt;
    assert.ok(lasted > 4_500 && lasted < 6_000, `lasted ${lasted} ms, expected about 5 s`);
  } finally {
    server.close();
  }
});
