// One game's roster: the players currently in its lobby or playing it (see
// sessionState.js - every game gets its own). The server is the single
// source of truth - clients never own this state.
//
// Players are keyed by clientId, a stable id the browser makes up once and
// keeps in localStorage - not by socket.id, which is a new random value for
// every connection. A phone reconnecting under a fresh connection (a new
// tab, waking back up, a dropped socket) sends the same clientId, so it
// replaces its previous entry instead of appearing twice.

// Mirrors client/src/character.js's SUIT_COLORS (keep the two in sync). Also
// doubles as the fallback order when a player's requested colour is already
// taken: the first one nobody else currently holds.
const SUIT_COLORS = [
  '#c51111', '#132ed1', '#117f2d', '#ed54ba', '#ef7d0d', '#f5f557',
  '#3f474e', '#d6e0f0', '#6b2fbb', '#71491e', '#38fedc', '#50ef39',
];

export function createRoster() {
  // clientId -> { id, socketId, name, photo, color, hat }. A Map keeps
  // insertion order, and re-setting an existing key keeps its place - so the
  // first entry is always whoever has been in this game the longest.
  const players = new Map();

  // The public shape broadcast to every client. socketId is a server-internal
  // connection detail, never anyone's business but the server's.
  function listPlayers() {
    return Array.from(players.values()).map(({ id, name, photo, color, hat }) => ({
      id,
      name,
      photo,
      color,
      hat,
    }));
  }

  return {
    // Colours are unique within a game. A requested colour is kept unless
    // someone else in it already has it, in which case it's swapped for the
    // first colour free in the palette above - falling back to the request
    // itself if every colour is somehow taken.
    resolveColor(clientId, requestedColor) {
      const takenByOthers = new Set(
        Array.from(players.values())
          .filter((player) => player.id !== clientId)
          .map((player) => player.color),
      );
      if (!takenByOthers.has(requestedColor)) return requestedColor;
      return SUIT_COLORS.find((color) => !takenByOthers.has(color)) || requestedColor;
    },

    addPlayer(clientId, socketId, name, photo = null, color = null, hat = null) {
      players.set(clientId, { id: clientId, socketId, name, photo, color, hat });
      return listPlayers();
    },

    // A disconnect only removes a player if it's still their current
    // connection. If they've since reconnected under a new socket (addPlayer
    // already overwrote this entry with the new socketId), this is a late
    // disconnect from the connection that got replaced, and must not wipe out
    // the one that took its place.
    removePlayer(clientId, socketId) {
      const existing = players.get(clientId);
      if (existing && existing.socketId !== socketId) return listPlayers();
      players.delete(clientId);
      return listPlayers();
    },

    findPlayerByClientId(clientId) {
      return players.get(clientId) || null;
    },

    listPlayers,

    clearPlayers() {
      players.clear();
    },
  };
}
