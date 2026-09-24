// Each phone's character (name, colour, hat, selfie), keyed by the same
// clientId the phone keeps in localStorage. Kept apart from sessionState.js on
// purpose: a session ending never touches this, so a returning player finds
// their character already filled in. Only lives in memory - a server restart
// (every deploy, or Render putting the free server to sleep) forgets it.

const characters = new Map(); // clientId -> { name, photo, color, hat }

export function saveCharacter(clientId, { name, photo, color, hat }) {
  characters.set(clientId, { name, photo, color, hat });
}

export function getCharacter(clientId) {
  return characters.get(clientId) || null;
}

export function clearCharacters() {
  characters.clear();
}
