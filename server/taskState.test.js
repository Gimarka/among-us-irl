import test from 'node:test';
import assert from 'node:assert/strict';
import { assignTasks, getTasks, completeTask, clearTasks, TASK_POOL } from './taskState.js';

function players(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `client${i}` }));
}

test('assignTasks gives every player exactly 6 tasks, all pending', () => {
  const tasks = assignTasks(players(3));
  assert.equal(tasks.size, 3);
  for (const list of tasks.values()) {
    assert.equal(list.length, 6);
    assert.ok(list.every((task) => task.done === false));
  }
});

test('a player\'s 6 tasks are unique and drawn from the task pool', () => {
  const tasks = assignTasks(players(1));
  const list = tasks.get('client0');
  const ids = list.map((task) => task.id);
  assert.equal(new Set(ids).size, 6, 'no task should repeat for the same player');
  assert.ok(ids.every((id) => TASK_POOL.includes(id)));
});

test('the task pool excludes door and emergency mini-games', () => {
  assert.ok(!TASK_POOL.includes('code-entry'));
  assert.ok(!TASK_POOL.includes('door-unlock'));
  assert.ok(!TASK_POOL.includes('emergency-fix'));
});

test('getTasks draws once and returns the same list on repeated calls', () => {
  clearTasks();
  const roster = players(3);
  const first = getTasks('client0', roster);
  const second = getTasks('client0', roster);
  assert.deepEqual(first, second);
});

test('a player who joins after the round started still gets 6 fresh tasks', () => {
  clearTasks();
  const roster = players(2);
  roster.forEach((player) => getTasks(player.id, roster));
  const latecomerTasks = getTasks('client-latecomer', roster);
  assert.equal(latecomerTasks.length, 6);
  assert.ok(latecomerTasks.every((task) => task.done === false));
});

test('clearTasks resets the draw for the next round', () => {
  clearTasks();
  const roster = players(2);
  getTasks('client0', roster);
  clearTasks();
  const tasks = assignTasks(players(2));
  assert.equal(tasks.size, 2);
});

test('completeTask marks a task done when it is in the player\'s list', () => {
  clearTasks();
  const roster = players(1);
  const list = getTasks('client0', roster);
  const someTaskId = list[0].id;
  const updated = completeTask('client0', someTaskId);
  assert.equal(updated.find((task) => task.id === someTaskId).done, true);
});

test('completeTask returns null (and changes nothing) when the task is not in the player\'s list', () => {
  clearTasks();
  const roster = players(1);
  const list = getTasks('client0', roster);
  const missingTaskId = TASK_POOL.find((id) => !list.some((task) => task.id === id));
  const result = completeTask('client0', missingTaskId);
  assert.equal(result, null);
  assert.ok(getTasks('client0', roster).every((task) => task.done === false));
});

test('completeTask returns null for a player with no tasks yet', () => {
  clearTasks();
  const result = completeTask('nobody-yet', 'sort');
  assert.equal(result, null);
});
