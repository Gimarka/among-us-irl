// Role assignment. The server draws once per game round and never tells a
// player anyone else's role (see the non-negotiable rule in CLAUDE.md).
// Always exactly one imposter (see docs/GAME_RULES.md), picked at random
// from the roster - everyone else is crewmate.

let roles = null; // clientId -> 'crewmate' | 'imposter', or null before a round has started

function shuffled(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Draws roles for the given roster and remembers them for the round.
// Exported mainly for tests - normal play goes through getRole below, which
// only draws once and reuses the same draw for everyone after that.
export function assignRoles(players) {
  const imposterId = players.length > 0 ? shuffled(players)[0].id : null;
  roles = new Map(players.map((player) => [player.id, player.id === imposterId ? 'imposter' : 'crewmate']));
  return roles;
}

// Returns one player's role, drawing roles for the whole current roster
// first if nobody has one yet this round. A player who joins after the
// round's roles were already drawn falls back to crewmate, rather than
// getting no role at all or reshuffling everyone else's.
export function getRole(clientId, currentPlayers) {
  if (!roles) assignRoles(currentPlayers);
  if (!roles.has(clientId)) roles.set(clientId, 'crewmate');
  return roles.get(clientId);
}

export function clearRoles() {
  roles = null;
}
