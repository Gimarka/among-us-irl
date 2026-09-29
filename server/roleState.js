// One game's role assignment (see sessionState.js - every game gets its
// own). The server draws once per game and never tells a player anyone
// else's role (see the non-negotiable rule in CLAUDE.md). The host picks how
// many imposters (see SETTINGS_LIMITS), drawn at random from the roster -
// everyone else is crewmate.

function shuffled(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createRoles() {
  let roles = null; // clientId -> 'crewmate' | 'imposter', or null before the game has started

  // Draws roles for the given roster and remembers them for the game.
  // There's always at least one crewmate (and one imposter): with too few
  // players for the imposter count asked for, it draws as many as it can.
  function assignRoles(players, imposterCount = 1) {
    const count = Math.max(1, Math.min(imposterCount, players.length - 1));
    const imposterIds = new Set(shuffled(players).slice(0, count).map((player) => player.id));
    roles = new Map(players.map((player) => [player.id, imposterIds.has(player.id) ? 'imposter' : 'crewmate']));
    return roles;
  }

  return {
    assignRoles,

    // Returns one player's role, drawing roles for the whole current roster
    // first if nobody has one yet. A player who joins after the roles were
    // drawn falls back to crewmate, rather than getting no role at all or
    // reshuffling everyone else's.
    getRole(clientId, currentPlayers) {
      if (!roles) assignRoles(currentPlayers);
      if (!roles.has(clientId)) roles.set(clientId, 'crewmate');
      return roles.get(clientId);
    },

    clearRoles() {
      roles = null;
    },
  };
}
