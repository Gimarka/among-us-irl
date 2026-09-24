// Simulates players starting the game and drawing roles: real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as ioClient } from 'socket.io-client';
import { createGameServer } from './index.js';
import { clearPlayers } from './gameState.js';
import { clearRoles } from './roleState.js';
import { clearTasks, assignTasks, TASK_POOL } from './taskState.js';

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

test('starting the game sends a player their own role only, never broadcast', async () => {
  clearPlayers();
  clearRoles();
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

    // Bob must never see a 'role' event meant for Alice.
    let bobSawARole = false;
    bob.on('role', () => { bobSawARole = true; });

    const aliceRole = waitForEvent(alice, 'role');
    alice.emit('startGame');
    const { role } = await aliceRole;

    assert.ok(role === 'crewmate' || role === 'imposter');
    assert.equal(bobSawARole, false, "Alice's role must not reach Bob");
  } finally {
    alice.close();
    bob.close();
    closeGameServer({ httpServer, io });
  }
});

test('two players starting the game together get exactly one traitor between them', async () => {
  clearPlayers();
  clearRoles();
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

    const aliceRole = waitForEvent(alice, 'role');
    alice.emit('startGame');
    const { role: aliceRoleValue } = await aliceRole;

    const bobRole = waitForEvent(bob, 'role');
    bob.emit('startGame');
    const { role: bobRoleValue } = await bobRole;

    const imposterCount = [aliceRoleValue, bobRoleValue].filter((role) => role === 'imposter').length;
    assert.equal(imposterCount, 1, 'exactly one of the two players must be the traitor');
  } finally {
    alice.close();
    bob.close();
    closeGameServer({ httpServer, io });
  }
});

test('a reconnecting player is told the same role they were already given', async () => {
  clearPlayers();
  clearRoles();
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
    const { role: firstRoleValue } = await firstRole;

    const secondRole = waitForEvent(alice, 'role');
    alice.emit('startGame');
    const { role: secondRoleValue } = await secondRole;

    assert.equal(firstRoleValue, secondRoleValue);
  } finally {
    alice.close();
    closeGameServer({ httpServer, io });
  }
});

test('starting the game also sends the player 6 unique tasks from the task pool', async () => {
  clearPlayers();
  clearRoles();
  clearTasks();
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
  clearRoles();
  clearTasks();
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
  clearRoles();
  clearTasks();
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
    // Nothing to wait on for an event that should never arrive - a second
    // startGame/role round trip on the same connection (which doesn't
    // disturb the already-drawn task list) is enough to know it didn't.
    const roundTrip = waitForEvent(alice, 'role');
    alice.emit('startGame');
    await roundTrip;

    assert.equal(sawTasksUpdate, false, "completing a task outside the player's list must not emit an update");
  } finally {
    alice.close();
    closeGameServer({ httpServer, io });
  }
});
