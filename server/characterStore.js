// Each phone's character (name, colour, hat, selfie), keyed by the same
// clientId the phone keeps in localStorage. Kept apart from the games on
// purpose: a game ending never touches this, so a returning player finds
// their character already filled in. Only lives in memory - a server restart
// (every deploy, or Render putting the free server to sleep) forgets it.
//
// Selfies are never sent inside the game's state (they'd make every update
// dozens of KB): phones load each one once from its own address, see
// photoUrl below and /photos in index.js. The address changes whenever the
// photo does, so a phone never shows an old one from its cache.

import { PHOTO_PREFIX } from './clean.js';

const characters = new Map(); // clientId -> { name, photo, color, hat, photoVersion }
let photoCounter = 0;

export function saveCharacter(clientId, { name, photo, color, hat }) {
  const previous = characters.get(clientId);
  const samePhoto = previous && previous.photo === photo;
  const photoVersion = samePhoto ? previous.photoVersion : (photoCounter += 1);
  characters.set(clientId, { name, photo, color, hat, photoVersion });
}

export function getCharacter(clientId) {
  const character = characters.get(clientId);
  if (!character) return null;
  const { name, photo, color, hat } = character;
  return { name, photo, color, hat };
}

// Where a phone can load this player's selfie, or null without one.
export function photoUrl(clientId) {
  const character = characters.get(clientId);
  if (!character?.photo) return null;
  return `/photos/${encodeURIComponent(clientId)}?v=${character.photoVersion}`;
}

// The selfie itself, as image bytes, for /photos.
export function photoData(clientId) {
  const photo = characters.get(clientId)?.photo;
  if (!photo) return null;
  return Buffer.from(photo.slice(PHOTO_PREFIX.length), 'base64');
}

export function clearCharacters() {
  characters.clear();
}
