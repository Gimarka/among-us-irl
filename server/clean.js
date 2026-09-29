// Everything a phone sends is checked here before the game uses it: a
// missing, malformed or oversized value is replaced by a safe default
// rather than refused, so a bad payload never stops a player from playing.

// Selfies arrive already shrunk and JPEG-compressed by the phone (a few KB).
// This cap only exists so a malformed or oversized payload can't sit in
// memory; the photo is dropped, the player still joins.
export const MAX_PHOTO_LENGTH = 100_000;
export const PHOTO_PREFIX = 'data:image/jpeg;base64,';

export function cleanPhoto(photo) {
  if (typeof photo !== 'string') return null;
  if (!photo.startsWith(PHOTO_PREFIX)) return null;
  if (photo.length > MAX_PHOTO_LENGTH) return null;
  return photo;
}

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

// null when missing or malformed: the game then picks a random free colour
// for the player (see resolveColor in roster.js).
export function cleanColor(color) {
  if (typeof color !== 'string') return null;
  return COLOR_PATTERN.test(color) ? color.toLowerCase() : null;
}

export const DEFAULT_HAT = 'none';
const HAT_PATTERN = /^[a-z]{1,20}$/;

export function cleanHat(hat) {
  if (typeof hat !== 'string') return DEFAULT_HAT;
  return HAT_PATTERN.test(hat) ? hat : DEFAULT_HAT;
}

export const MAX_NAME_LENGTH = 20;

export function cleanName(name) {
  return String(name || '').trim().slice(0, MAX_NAME_LENGTH) || 'Joueur';
}

// Matches the client's input maxlength (see CHAT_MAX_LENGTH in main.js) -
// this is the enforced copy, that one's just so the phone's keyboard stops
// early instead of typing into the void.
export const MAX_CHAT_LENGTH = 300;

export function cleanChatText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, MAX_CHAT_LENGTH);
}

// The browser makes this up once and keeps it in localStorage; it's what
// lets a reconnecting phone be recognised as the same player rather than a
// new one. A missing or malformed one falls back to this connection's own
// socket id, which just means this join won't be merged with any other.
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function cleanClientId(clientId, fallback) {
  return typeof clientId === 'string' && CLIENT_ID_PATTERN.test(clientId) ? clientId : fallback;
}

// Who a phone says it is when it creates or joins a game. A phone coming
// back after a dropped connection leaves the photo out (undefined): the
// game then keeps the one it already has, instead of the phone re-sending
// its selfie on every reconnect.
export function cleanIdentity({ clientId, name, photo, color, hat } = {}, fallbackId) {
  return {
    clientId: cleanClientId(clientId, fallbackId),
    name: cleanName(name),
    photo: photo === undefined ? undefined : cleanPhoto(photo),
    color: cleanColor(color),
    hat: cleanHat(hat),
  };
}
