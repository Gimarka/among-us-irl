// Task assignment for players, one per game (see sessionState.js - every
// game gets its own). Each player gets tasks drawn at random
// (no repeats) from the pool of task mini-games - not Code entry (now a
// door-opening mechanic, not a per-player checklist item) or Emergency fix
// (a shared event, not assigned to anyone). See docs/MINIGAMES.md.

export const TASK_POOL = [
  'wires',
  'card-swipe',
  'download',
  'fuel',
  'calibrate',
  'simon',
  'clean',
  'sort',
  'steady-hand',
];

// Where each task is played, fixed by the house layout (see
// docs/MINIGAMES.md and docs/HOUSE_MAP.md) - not drawn, so the same for every
// player and every session. Ids match the room QR codes (`room-kitchen`...);
// the French names live in the client's texts.fr.js.
export const TASK_ROOMS = {
  wires: 'garage',
  'card-swipe': 'bedroom-1',
  download: 'garden',
  fuel: 'bathroom',
  calibrate: 'bedroom-2',
  simon: 'bedroom-2',
  clean: 'kitchen',
  sort: 'kitchen',
  'steady-hand': 'garage',
};

const TASKS_PER_PLAYER = 6; // unless the host sets another number (see SETTINGS_LIMITS)

function shuffled(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function drawTaskList(count) {
  return shuffled(TASK_POOL)
    .slice(0, count)
    .map((id) => ({ id, room: TASK_ROOMS[id], done: false }));
}

export function createTasks() {
  let tasks = null; // clientId -> [{ id, room, done }], or null before the game has started
  let perPlayer = TASKS_PER_PLAYER;

  // Draws task lists for the given roster and remembers them (and how many
  // each) for the game, so a latecomer gets the same number.
  function assignTasks(players, count = TASKS_PER_PLAYER) {
    perPlayer = count;
    tasks = new Map(players.map((player) => [player.id, drawTaskList(perPlayer)]));
    return tasks;
  }

  return {
    assignTasks,

    // Returns one player's task list, drawing lists for the whole current
    // roster first if nobody has one yet. A player who joins after the tasks
    // were drawn gets their own fresh draw rather than no tasks at all.
    getTasks(clientId, currentPlayers) {
      if (!tasks) assignTasks(currentPlayers);
      if (!tasks.has(clientId)) tasks.set(clientId, drawTaskList(perPlayer));
      return tasks.get(clientId);
    },

    // Marks one task done for a player, if it's actually one of their
    // assigned tasks - a no-op otherwise (a minigame reporting completion has
    // no way of knowing whether its task was in that particular player's list,
    // and it shouldn't need to). Returns the player's updated task list, or
    // null if there was nothing to update - no task list yet, or this task
    // isn't in it - so the caller only tells the player about a real change.
    completeTask(clientId, taskId) {
      const list = tasks?.get(clientId);
      if (!list) return null;
      const task = list.find((item) => item.id === taskId);
      if (!task) return null;
      task.done = true;
      return list;
    },

    // Share of these players' tasks that are done, from 0 to 1 (0 when
    // they have none). Players without a task list yet don't count.
    progress(clientIds) {
      const lists = clientIds.map((id) => tasks?.get(id)).filter(Boolean);
      const total = lists.reduce((sum, list) => sum + list.length, 0);
      const done = lists.reduce((sum, list) => sum + list.filter((task) => task.done).length, 0);
      return total === 0 ? 0 : done / total;
    },

    clearTasks() {
      tasks = null;
    },
  };
}
