// One game's chat log (see sessionState.js - every game gets its own). The
// server is the single source of truth, and it lives only for the life of
// the game.

const MAX_HISTORY = 200; // oldest messages fall off once the log gets this long

export function createChat() {
  const messages = [];
  let nextId = 1;

  return {
    addMessage({ clientId, name, photo, color, hat, text }) {
      const message = { id: nextId, clientId, name, photo, color, hat, text, at: Date.now() };
      nextId += 1;
      messages.push(message);
      if (messages.length > MAX_HISTORY) messages.shift();
      return message;
    },

    listMessages() {
      return messages.slice();
    },

    clearMessages() {
      messages.length = 0;
      nextId = 1;
    },
  };
}
