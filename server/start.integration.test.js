// Starting a game: roles, tasks and the host's settings. Real HTTP server,
// real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, wait, act, until, lobbyOf, startedGame } from './testSupport.js';
import { TASK_POOL } from './taskState.js';

test('the host\'s JOUER gives every lobby player their own role, never anyone else\'s, exactly one traitor', async () => {
  const server = await startServer();
  try {
    const { phones } = await lobbyOf(server, ['Alice', 'Bob', 'Carol']);
    await act(phones[0], 'start');
    const states = await Promise.all(phones.map((phone) => until(phone, (s) => s.me.member)));

    assert.equal(states.filter((s) => s.me.role === 'imposter').length, 1);
    // A phone's state has exactly one role in it: its own.
    for (const state of states) {
      assert.equal((JSON.stringify(state).match(/"role"/g) || []).length, 1);
    }
  } finally {
    server.close();
  }
});

test('only the host can start the game, and pressing JOUER again changes nothing', async () => {
  const server = await startServer();
  try {
    const { phones: [alice, bob] } = await lobbyOf(server, ['Alice', 'Bob']);
    assert.equal((await act(bob, 'start')).ok, false);
    assert.equal(alice.state.game.started, false);

    await act(alice, 'start');
    await act(alice, 'roleSeen');
    const { me } = await until(alice, (s) => s.me.roleSeen);
    await act(alice, 'start');
    await wait(30);
    assert.deepEqual(alice.state.me, me, 'no second reveal, same role and tasks');
  } finally {
    server.close();
  }
});

test('starting the game gives each player 6 unique tasks from the task pool', async () => {
  const server = await startServer();
  try {
    const { phones: [alice] } = await startedGame(server, ['Alice']);
    const { tasks } = alice.state.me;
    assert.equal(tasks.length, 6);
    assert.ok(tasks.every((task) => task.done === false && TASK_POOL.includes(task.id)));
    assert.equal(new Set(tasks.map((task) => task.id)).size, 6, 'no task should repeat');
  } finally {
    server.close();
  }
});

test('completing a task in the player\'s list marks it done for them only; one outside it changes nothing', async () => {
  const server = await startServer();
  try {
    const { phones: [alice, bob] } = await startedGame(server, ['Alice', 'Bob']);
    const { tasks } = alice.state.me;
    const bobTasks = bob.state.me.tasks;

    await act(alice, 'completeTask', { taskId: tasks[0].id });
    await until(alice, (s) => s.me.tasks[0].done);
    assert.deepEqual(bob.state.me.tasks, bobTasks, "Alice's task doesn't touch Bob's list");

    const outside = TASK_POOL.find((id) => !tasks.some((task) => task.id === id));
    await act(alice, 'completeTask', { taskId: outside });
    assert.equal(alice.state.me.tasks.filter((task) => task.done).length, 1);

    // TEST TÂCHE: one more, at random.
    await act(alice, 'completeRandomTask');
    await until(alice, (s) => s.me.tasks.filter((task) => task.done).length === 2);
  } finally {
    server.close();
  }
});

test('only the host can change the settings, only before JOUER, and everyone sees them', async () => {
  const server = await startServer();
  try {
    const { phones: [host, guest] } = await lobbyOf(server, ['Host', 'Guest']);
    assert.equal((await act(guest, 'updateSettings', { imposterCount: 3 })).ok, false, 'a guest cannot');

    await act(host, 'updateSettings', { imposterCount: 2, tasksPerPlayer: 4, alertSeconds: 30, interferenceSeconds: 20 });
    const heard = await until(guest, (s) => s.game.settings.imposterCount === 2);
    assert.deepEqual(heard.game.settings, { imposterCount: 2, tasksPerPlayer: 4, alertSeconds: 30, interferenceSeconds: 20 });

    await act(host, 'start');
    assert.equal((await act(host, 'updateSettings', { imposterCount: 1 })).ok, false, 'fixed once started');
  } finally {
    server.close();
  }
});

test('JOUER draws the chosen number of imposters and tasks', async () => {
  const server = await startServer();
  try {
    const { phones } = await lobbyOf(server, ['P0', 'P1', 'P2', 'P3', 'P4']);
    await act(phones[0], 'updateSettings', { imposterCount: 2, tasksPerPlayer: 3 });
    await act(phones[0], 'start');
    const states = await Promise.all(phones.map((phone) => until(phone, (s) => s.me.member)));
    assert.equal(states.filter((s) => s.me.role === 'imposter').length, 2);
    states.forEach((s) => assert.equal(s.me.tasks.length, 3));
  } finally {
    server.close();
  }
});

test('the alert countdown and the interference last as long as the settings say', async () => {
  const server = await startServer();
  try {
    const { phones: [host] } = await lobbyOf(server, ['Host']);
    await act(host, 'updateSettings', { alertSeconds: 20, interferenceSeconds: 5 });
    await act(host, 'start');
    await act(host, 'roleSeen');

    await act(host, 'alertStart');
    const { alert } = await until(host, (s) => s.alert.active);
    assert.equal(alert.durationMs, 20_000);
    assert.ok(alert.remainingMs > 19_000 && alert.remainingMs <= 20_000);

    await act(host, 'interferenceStart');
    await until(host, (s) => s.interference.active);
    const startedAt = Date.now();
    await until(host, (s) => !s.interference.active, 7000);
    const lasted = Date.now() - startedAt;
    assert.ok(lasted > 4_500 && lasted < 6_000, `lasted ${lasted} ms, expected about 5 s`);
  } finally {
    server.close();
  }
});
