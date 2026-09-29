// Starting a game: roles and tasks. Real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, hello, createGame, joinGame } from './testSupport.js';
import { TASK_POOL } from './taskState.js';

async function lobbyOfTwo(server) {
  const alice = await server.connect();
  const bob = await server.connect();
  const { sessionId } = await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
  await joinGame(bob, sessionId, { clientId: 'bob', name: 'Bob' });
  return { alice, bob, sessionId };
}

test('the host\'s JOUER gives every lobby player their own role privately, exactly one traitor', async () => {
  const server = await startServer();
  try {
    const { alice, bob } = await lobbyOfTwo(server);
    const roles = Promise.all([waitForEvent(alice, 'role'), waitForEvent(bob, 'role')]);
    alice.emit('startGame');
    const [aliceStart, bobStart] = await roles;

    // Nothing in the payload about anyone else - just this player's own role and tasks.
    assert.deepEqual(Object.keys(aliceStart).sort(), ['role', 'tasks']);
    assert.deepEqual(Object.keys(bobStart).sort(), ['role', 'tasks']);
    const imposterCount = [aliceStart.role, bobStart.role].filter((role) => role === 'imposter').length;
    assert.equal(imposterCount, 1, 'exactly one of the two players must be the traitor');
  } finally {
    server.close();
  }
});

test('only the host can start the game', async () => {
  const server = await startServer();
  try {
    const { alice, bob } = await lobbyOfTwo(server);
    let started = false;
    alice.on('role', () => { started = true; });
    bob.emit('startGame');
    await hello(bob, 'bob'); // answered in order, so startGame has been handled by now
    assert.equal(started, false);
  } finally {
    server.close();
  }
});

test('pressing JOUER a second time does not replay the role reveal', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    const firstRole = waitForEvent(alice, 'role');
    alice.emit('startGame');
    await firstRole;

    let roleCount = 0;
    alice.on('role', () => { roleCount += 1; });
    alice.emit('startGame');
    await hello(alice, 'alice');
    assert.equal(roleCount, 0);
  } finally {
    server.close();
  }
});

test('starting the game also sends the player 6 unique tasks from the task pool', async () => {
  const server = await startServer();
  try {
    const alice = await server.connect();
    await createGame(alice, 'Maison', { clientId: 'alice', name: 'Alice' });
    const started = waitForEvent(alice, 'role');
    alice.emit('startGame');
    const { tasks } = await started;

    assert.equal(tasks.length, 6);
    assert.ok(tasks.every((task) => task.done === false));
    assert.ok(tasks.every((task) => TASK_POOL.includes(task.id)));
    assert.equal(new Set(tasks.map((task) => task.id)).size, 6, 'no task should repeat');
  } finally {
    server.close();
  }
});

test('completing a task in the player\'s list marks it done privately; one outside it changes nothing', async () => {
  const server = await startServer();
  try {
    const { alice, bob } = await lobbyOfTwo(server);
    const roles = Promise.all([waitForEvent(alice, 'role'), waitForEvent(bob, 'role')]);
    alice.emit('startGame');
    const [{ tasks }] = await roles;

    let bobSawTasks = false;
    bob.on('tasks', () => { bobSawTasks = true; });
    const updated = waitForEvent(alice, 'tasks');
    alice.emit('completeTask', { taskId: tasks[0].id });
    assert.equal((await updated).find((task) => task.id === tasks[0].id).done, true);
    assert.equal(bobSawTasks, false, "Alice's task update must not reach Bob");

    let sawUpdate = false;
    alice.on('tasks', () => { sawUpdate = true; });
    alice.emit('completeTask', { taskId: TASK_POOL.find((id) => !tasks.some((task) => task.id === id)) });
    await hello(alice, 'alice');
    assert.equal(sawUpdate, false, 'a task outside the list must not emit an update');
  } finally {
    server.close();
  }
});
