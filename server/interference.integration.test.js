// Confirms interference reaches every connected phone and auto-expires:
// real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createGameServer } from './index.js';
import { clearInterference } from './interferenceState.js';

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

test('interferenceStart broadcasts to every socket and auto-expires on its own', async () => {
  clearInterference();
  const { httpServer, io } = createGameServer({ interferenceDurationMs: 40 });
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);
  const bob = ioClient(url);

  try {
    await Promise.all([waitForEvent(alice, 'connect'), waitForEvent(bob, 'connect')]);

    const bothStarted = Promise.all([waitForEvent(alice, 'interference'), waitForEvent(bob, 'interference')]);
    alice.emit('interferenceStart');
    const [aliceStart, bobStart] = await bothStarted;
    assert.equal(aliceStart.active, true);
    assert.equal(bobStart.active, true);

    const bothExpired = Promise.all([waitForEvent(alice, 'interference'), waitForEvent(bob, 'interference')]);
    const [aliceEnd, bobEnd] = await bothExpired;
    assert.equal(aliceEnd.active, false, 'must turn itself off without a second button press');
    assert.equal(bobEnd.active, false);
  } finally {
    alice.close();
    bob.close();
    closeGameServer({ httpServer, io });
  }
});
