// Counting a meeting's votes (see the meeting in index.js). A vote is either
// a player's id or SKIP_VOTE ("PASSER").

export const SKIP_VOTE = 'skip';

// votes: Map voterId -> targetId. The one player with the most votes is
// eliminated; no votes, a tie for the most, or PASSER having the most (or
// sharing it) eliminates nobody. Returns the eliminated id, or null.
export function tallyVotes(votes) {
  const counts = new Map();
  votes.forEach((target) => counts.set(target, (counts.get(target) || 0) + 1));

  let best = null;
  let bestCount = 0;
  let tie = false;
  counts.forEach((count, target) => {
    if (count > bestCount) {
      best = target;
      bestCount = count;
      tie = false;
    } else if (count === bestCount) {
      tie = true;
    }
  });

  if (best === null || tie || best === SKIP_VOTE) return null;
  return best;
}
