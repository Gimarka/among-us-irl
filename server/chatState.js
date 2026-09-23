// In-memory chat log, shared the same way the player roster is (see
// gameState.js): the server is the single source of truth, and it lives
// only for the life of the process - there's no game state here that needs
// to survive a restart.

const MAX_HISTORY = 200; // oldest messages fall off once the log gets this long

const messages = [];
let nextId = 1;

export function addMessage({ clientId, name, photo, color, hat, text }) {
  const message = { id: nextId, clientId, name, photo, color, hat, text, at: Date.now() };
  nextId += 1;
  messages.push(message);
  if (messages.length > MAX_HISTORY) messages.shift();
  return message;
}

export function listMessages() {
  return messages.slice();
}

export function clearMessages() {
  messages.length = 0;
  nextId = 1;
}
