// In-memory list of connected players. Step 1: one shared room, name only.
// The server is the single source of truth — clients never own this state.
//
// Players are keyed by clientId, a stable id the browser makes up once and
// keeps in localStorage — not by socket.id, which is a new random value for
// every connection. A phone reconnecting under a fresh connection (a new
// tab, waking back up, a dropped socket) sends the same clientId, so it
// replaces its previous entry instead of appearing twice.

const players = new Map(); // clientId -> { id, socketId, name, photo, color, hat }

export function addPlayer(clientId, socketId, name, photo = null, color = null, hat = null) {
  players.set(clientId, { id: clientId, socketId, name, photo, color, hat });
  return listPlayers();
}

// A disconnect only removes a player if it's still their current
// connection. If they've since reconnected under a new socket (addPlayer
// already overwrote this entry with the new socketId), this is a late
// disconnect from the connection that got replaced, and must not wipe out
// the one that took its place.
export function removePlayer(clientId, socketId) {
  const existing = players.get(clientId);
  if (existing && existing.socketId !== socketId) return listPlayers();
  players.delete(clientId);
  return listPlayers();
}

export function findPlayerByClientId(clientId) {
  return players.get(clientId) || null;
}

// The public shape broadcast to every client. socketId is a server-internal
// connection detail, never anyone's business but the server's.
export function listPlayers() {
  return Array.from(players.values()).map(({ id, name, photo, color, hat }) => ({
    id,
    name,
    photo,
    color,
    hat,
  }));
}

export function clearPlayers() {
  players.clear();
}
