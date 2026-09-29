// One game's role assignment (see sessionState.js - every game gets its
// own). The server draws once per game and never tells a player anyone
// else's role (see the non-negotiable rule in CLAUDE.md). Always exactly one
// imposter (see docs/GAME_RULES.md), picked at random from the roster -
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
  function assignRoles(players) {
    const imposterId = players.length > 0 ? shuffled(players)[0].id : null;
    roles = new Map(players.map((player) => [player.id, player.id === imposterId ? 'imposter' : 'crewmate']));
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
