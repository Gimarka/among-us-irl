// Confirms an alert reaches every connected phone, not just the one that
// triggered it: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createGameServer } from './index.js';
import { setAlertActive } from './alertState.js';

function listenOnRandomPort(server) {
  return new Promise((resolve) => {
    server.listen(0, () => resolve(server.address().port));
  });
}

function waitForEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

// See join.integration.test.js for why this (rather than a plain io.close())
// is needed to let the test process exit cleanly.
function closeGameServer({ httpServer, io }) {
  io.close();
  httpServer.closeAllConnections();
}

test('alertStart/alertStop broadcast to every connected socket, and a new connection gets the current state', async () => {
  setAlertActive(false);
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);
  const bob = ioClient(url);

  try {
    await Promise.all([waitForEvent(alice, 'connect'), waitForEvent(bob, 'connect')]);

    const bothStarted = Promise.all([waitForEvent(alice, 'alert'), waitForEvent(bob, 'alert')]);
    alice.emit('alertStart');
    const [aliceStart, bobStart] = await bothStarted;
    assert.equal(aliceStart.active, true);
    assert.equal(bobStart.active, true);

    // A phone connecting mid-alert should see it's already active.
    const carol = ioClient(url);
    const carolInitial = await waitForEvent(carol, 'alert');
    assert.equal(carolInitial.active, true);
    carol.close();

    const bothStopped = Promise.all([waitForEvent(alice, 'alert'), waitForEvent(bob, 'alert')]);
    bob.emit('alertStop');
    const [aliceStop, bobStop] = await bothStopped;
    assert.equal(aliceStop.active, false);
    assert.equal(bobStop.active, false);
  } finally {
    alice.close();
    bob.close();
    closeGameServer({ httpServer, io });
  }
});
