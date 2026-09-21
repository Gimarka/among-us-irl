// In-memory list of connected players. Step 1: one shared room, name only.
// The server is the single source of truth — clients never own this state.

const players = new Map(); // socketId -> { id, name, photo, color, hat }

export function addPlayer(id, name, photo = null, color = null, hat = null) {
  players.set(id, { id, name, photo, color, hat });
  return listPlayers();
}

export function removePlayer(id) {
  players.delete(id);
  return listPlayers();
}

export function listPlayers() {
  return Array.from(players.values());
}

export function clearPlayers() {
  players.clear();
}
