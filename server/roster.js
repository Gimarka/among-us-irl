// One game's roster: the players currently in its lobby or playing it.
//
// Players are keyed by clientId, a stable id the browser makes up once and
// keeps in localStorage - not by connection, which changes every time a
// phone reconnects. A phone coming back sends the same clientId, so it takes
// back its own entry instead of appearing twice. Which connection belongs to
// whom is the server's business (see index.js); here a player is only
// "online" or not.

// Mirrors client/src/character.js's SUIT_COLORS (keep the two in sync).
export const SUIT_COLORS = [
  '#c51111', '#132ed1', '#117f2d', '#ed54ba', '#ef7d0d', '#f5f557',
  '#3f474e', '#d6e0f0', '#6b2fbb', '#71491e', '#38fedc', '#50ef39',
];

export function createRoster() {
  // clientId -> { id, name, color, hat, online }. A Map keeps insertion
  // order, and re-setting an existing key keeps its place - so the first
  // entry is always whoever has been in this game the longest.
  const players = new Map();

  return {
    // Colours are unique within a game. A requested colour (the player's
    // saved one) is kept unless someone else in it already has it; without
    // one, or if it's taken, the player gets a random colour nobody else in
    // the game holds - falling back to the request itself, or the first
    // colour, if every colour is somehow taken.
    resolveColor(clientId, requestedColor) {
      const takenByOthers = new Set(
        Array.from(players.values())
          .filter((player) => player.id !== clientId)
          .map((player) => player.color),
      );
      if (requestedColor && !takenByOthers.has(requestedColor)) return requestedColor;
      const free = SUIT_COLORS.filter((color) => !takenByOthers.has(color));
      if (free.length === 0) return requestedColor || SUIT_COLORS[0];
      return free[Math.floor(Math.random() * free.length)];
    },

    // Adds a player, or updates one already here (keeping their place).
    add(clientId, { name, color, hat }) {
      players.set(clientId, { id: clientId, name, color, hat, online: true });
    },

    update(clientId, fields) {
      const player = players.get(clientId);
      if (player) Object.assign(player, fields);
    },

    remove(clientId) {
      players.delete(clientId);
    },

    get(clientId) {
      return players.get(clientId) || null;
    },

    // Copies, in the order players arrived.
    list() {
      return Array.from(players.values(), (player) => ({ ...player }));
    },
  };
}
