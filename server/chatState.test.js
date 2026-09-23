import test from 'node:test';
import assert from 'node:assert/strict';
import { addMessage, listMessages, clearMessages } from './chatState.js';

test('addMessage adds a message and returns it with an id and timestamp', () => {
  clearMessages();
  const message = addMessage({ clientId: 'client1', name: 'Alice', text: 'salut' });
  assert.equal(message.name, 'Alice');
  assert.equal(message.text, 'salut');
  assert.equal(typeof message.id, 'number');
  assert.equal(typeof message.at, 'number');
});

test('listMessages returns messages in the order they were sent', () => {
  clearMessages();
  addMessage({ clientId: 'client1', name: 'Alice', text: 'un' });
  addMessage({ clientId: 'client2', name: 'Bob', text: 'deux' });
  const messages = listMessages();
  assert.deepEqual(messages.map((m) => m.text), ['un', 'deux']);
});

test('listMessages reflects current state without mutating it', () => {
  clearMessages();
  addMessage({ clientId: 'client1', name: 'Alice', text: 'salut' });
  const a = listMessages();
  const b = listMessages();
  assert.deepEqual(a, b);
});

test('the log drops the oldest messages once it grows past its cap', () => {
  clearMessages();
  for (let i = 0; i < 205; i += 1) {
    addMessage({ clientId: 'client1', name: 'Alice', text: `message ${i}` });
  }
  const messages = listMessages();
  assert.equal(messages.length, 200);
  assert.equal(messages[0].text, 'message 5', 'the oldest 5 should have fallen off');
  assert.equal(messages[messages.length - 1].text, 'message 204');
});

test('clearMessages empties the log and resets ids', () => {
  clearMessages();
  addMessage({ clientId: 'client1', name: 'Alice', text: 'salut' });
  clearMessages();
  assert.deepEqual(listMessages(), []);
  const message = addMessage({ clientId: 'client1', name: 'Alice', text: 'again' });
  assert.equal(message.id, 1);
});
