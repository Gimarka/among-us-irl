// Role assignment. The server draws once per game round and never tells a
// player anyone else's role (see the non-negotiable rule in CLAUDE.md).
// Imposter count follows docs/GAME_RULES.md's odds table: always 1 at 4
// players, 1 or 2 at 5 (30% chance of 2) and 6 (50% chance of 2). Outside
// that designed 4-6 range (this project's test screens allow more or fewer
// players to join) it falls back to a single imposter.

let roles = null; // clientId -> 'crewmate' | 'imposter', or null before a round has started

function pickImposterCount(playerCount) {
  if (playerCount < 2) return 0;
  if (playerCount === 5) return Math.random() < 0.3 ? 2 : 1;
  if (playerCount === 6) return Math.random() < 0.5 ? 2 : 1;
  return 1;
}

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
  const imposterCount = Math.min(pickImposterCount(players.length), players.length);
  const imposterIds = new Set(shuffled(players).slice(0, imposterCount).map((player) => player.id));
  roles = new Map(players.map((player) => [player.id, imposterIds.has(player.id) ? 'imposter' : 'crewmate']));
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
