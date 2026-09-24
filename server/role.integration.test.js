// Simulates players starting the game and drawing roles: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createGameServer } from './index.js';
import { clearPlayers } from './gameState.js';
import { endSession } from './sessionState.js';
import { TASK_POOL } from './taskState.js';

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

test('JOUER gives every lobby player their own role privately, exactly one traitor', async () => {
  clearPlayers();
  endSession();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);
  const bob = ioClient(url);

  try {
    await Promise.all([waitForEvent(alice, 'connect'), waitForEvent(bob, 'connect')]);

    const aliceJoined = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    alice.emit('join', { name: 'Alice' });
    await aliceJoined;

    const bobJoined = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    bob.emit('join', { name: 'Bob' });
    await bobJoined;

    // Only Alice presses JOUER, but both are in the lobby, so both start.
    const roles = Promise.all([waitForEvent(alice, 'role'), waitForEvent(bob, 'role')]);
    alice.emit('startGame');
    const [aliceStart, bobStart] = await roles;

    // Nothing in the payload about anyone else - just this player's own role and tasks.
    assert.deepEqual(Object.keys(aliceStart).sort(), ['role', 'tasks']);
    assert.deepEqual(Object.keys(bobStart).sort(), ['role', 'tasks']);
    const imposterCount = [aliceStart.role, bobStart.role].filter((role) => role === 'imposter').length;
    assert.equal(imposterCount, 1, 'exactly one of the two players must be the traitor');
  } finally {
    alice.close();
    bob.close();
    closeGameServer({ httpServer, io });
  }
});

test('pressing JOUER a second time does not replay the role reveal', async () => {
  clearPlayers();
  endSession();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);

  try {
    await waitForEvent(alice, 'connect');
    const joined = waitForEvent(alice, 'players');
    alice.emit('join', { name: 'Alice', clientId: 'alice-client' });
    await joined;

    const firstRole = waitForEvent(alice, 'role');
    alice.emit('startGame');
    await firstRole;

    let roleCount = 0;
    alice.on('role', () => { roleCount += 1; });
    alice.emit('startGame');
    // hello/welcome is answered in order, so once it's back the second
    // startGame has definitely been handled.
    const roundTrip = waitForEvent(alice, 'welcome');
    alice.emit('hello', { clientId: 'alice-client' });
    await roundTrip;

    assert.equal(roleCount, 0);
  } finally {
    alice.close();
    closeGameServer({ httpServer, io });
  }
});

test('starting the game also sends the player 6 unique tasks from the task pool', async () => {
  clearPlayers();
  endSession();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);

  try {
    await waitForEvent(alice, 'connect');
    const joined = waitForEvent(alice, 'players');
    alice.emit('join', { name: 'Alice' });
    await joined;

    const started = waitForEvent(alice, 'role');
    alice.emit('startGame');
    const { tasks } = await started;

    assert.equal(tasks.length, 6);
    assert.ok(tasks.every((task) => task.done === false));
    assert.ok(tasks.every((task) => TASK_POOL.includes(task.id)));
    assert.equal(new Set(tasks.map((task) => task.id)).size, 6, 'no task should repeat');
  } finally {
    alice.close();
    closeGameServer({ httpServer, io });
  }
});

test('completing a task that is in the player\'s list marks it done privately', async () => {
  clearPlayers();
  endSession();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);
  const bob = ioClient(url);

  try {
    await Promise.all([waitForEvent(alice, 'connect'), waitForEvent(bob, 'connect')]);

    const aliceJoined = Promise.all([waitForEvent(alice, 'players'), waitForEvent(bob, 'players')]);
    alice.emit('join', { name: 'Alice' });
    await aliceJoined;

    const started = waitForEvent(alice, 'role');
    alice.emit('startGame');
    const { tasks } = await started;
    const presentTaskId = tasks[0].id;

    let bobSawTasks = false;
    bob.on('tasks', () => { bobSawTasks = true; });

    const updated = waitForEvent(alice, 'tasks');
    alice.emit('completeTask', { taskId: presentTaskId });
    const updatedTasks = await updated;

    assert.equal(updatedTasks.find((task) => task.id === presentTaskId).done, true);
    assert.equal(bobSawTasks, false, "Alice's task update must not reach Bob");
  } finally {
    alice.close();
    bob.close();
    closeGameServer({ httpServer, io });
  }
});

test('completing a task that is not in the player\'s list changes nothing', async () => {
  clearPlayers();
  endSession();
  const { httpServer, io } = createGameServer();
  const port = await listenOnRandomPort(httpServer);
  const url = `http://localhost:${port}`;

  const alice = ioClient(url);

  try {
    await waitForEvent(alice, 'connect');
    const joined = waitForEvent(alice, 'players');
    alice.emit('join', { name: 'Alice' });
    await joined;

    const started = waitForEvent(alice, 'role');
    alice.emit('startGame');
    const { tasks } = await started;
    const missingTaskId = TASK_POOL.find((id) => !tasks.some((task) => task.id === id));

    let sawTasksUpdate = false;
    alice.on('tasks', () => { sawTasksUpdate = true; });

    alice.emit('completeTask', { taskId: missingTaskId });
    // Nothing to wait on for an event that should never arrive - a
    // hello/welcome round trip on the same connection is enough to know it didn't.
    const roundTrip = waitForEvent(alice, 'welcome');
    alice.emit('hello', {});
    await roundTrip;

    assert.equal(sawTasksUpdate, false, "completing a task outside the player's list must not emit an update");
  } finally {
    alice.close();
    closeGameServer({ httpServer, io });
  }
});
