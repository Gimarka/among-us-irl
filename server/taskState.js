// Task assignment for players. Each player gets 6 tasks drawn at random
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

const TASKS_PER_PLAYER = 6;

let tasks = null; // clientId -> [{ id, done }], or null before a round has started

function shuffled(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function drawTaskList() {
  return shuffled(TASK_POOL)
    .slice(0, TASKS_PER_PLAYER)
    .map((id) => ({ id, room: TASK_ROOMS[id], done: false }));
}

// Draws task lists for the given roster and remembers them for the round.
// Exported mainly for tests - normal play goes through getTasks below,
// which only draws once and reuses the same draw for everyone after that.
export function assignTasks(players) {
  tasks = new Map(players.map((player) => [player.id, drawTaskList()]));
  return tasks;
}

// Returns one player's task list, drawing lists for the whole current
// roster first if nobody has one yet this round. A player who joins after
// the round's tasks were already drawn gets their own fresh draw rather
// than no tasks at all.
export function getTasks(clientId, currentPlayers) {
  if (!tasks) assignTasks(currentPlayers);
  if (!tasks.has(clientId)) tasks.set(clientId, drawTaskList());
  return tasks.get(clientId);
}

// Marks one task done for a player, if it's actually one of their assigned
// tasks - a no-op otherwise (a minigame reporting completion has no way of
// knowing whether its task was in that particular player's 6, and it
// shouldn't need to). Returns the player's updated task list, or null if
// there was nothing to update - no task list yet, or this task isn't in
// it - so the caller only tells the player about a real change.
export function completeTask(clientId, taskId) {
  const list = tasks?.get(clientId);
  if (!list) return null;
  const task = list.find((item) => item.id === taskId);
  if (!task) return null;
  task.done = true;
  return list;
}

export function clearTasks() {
  tasks = null;
}
