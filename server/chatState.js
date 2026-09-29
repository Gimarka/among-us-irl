// One game's chat log. The server is the single source of truth, and it
// lives only for the life of the game. Phones are told the id of the latest
// message (in the game's state) and fetch whatever they don't have yet, so
// a phone that was offline for a while catches up on every message.
//
// The sender's name, colour and hat are copied onto the message itself, so
// it keeps showing who sent it even if that player later leaves.

const MAX_HISTORY = 200; // oldest messages fall off once the log gets this long

export function createChat() {
  const messages = [];
  let nextId = 1;

  return {
    addMessage({ clientId, name, color, hat, text }) {
      const message = { id: nextId, clientId, name, color, hat, text, at: Date.now() };
      nextId += 1;
      messages.push(message);
      if (messages.length > MAX_HISTORY) messages.shift();
      return message;
    },

    listMessages() {
      return messages.slice();
    },

    // The messages a phone doesn't have yet: every one after the last it has.
    messagesAfter(id) {
      return messages.filter((message) => message.id > id);
    },

    // 0 before the first message.
    lastId() {
      return nextId - 1;
    },

    clearMessages() {
      messages.length = 0;
      nextId = 1;
    },
  };
}
