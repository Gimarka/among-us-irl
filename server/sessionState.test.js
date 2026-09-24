import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startSession,
  endSession,
  getSessionId,
  isMember,
  addMember,
  hasSeenRole,
  markRoleSeen,
} from './sessionState.js';
import { addMessage, listMessages } from './chatState.js';
import { isAlertActive, setAlertActive } from './alertState.js';

test('each new session gets the next id, and none is running after it ends', () => {
  endSession();
  assert.equal(getSessionId(), null);
  const first = startSession();
  endSession();
  const second = startSession();
  assert.equal(second, first + 1);
  endSession();
  assert.equal(getSessionId(), null);
});

test('starting a session wipes the previous one\'s chat and alert', () => {
  endSession();
  addMessage({ clientId: 'a', name: 'A', text: 'hi' });
  setAlertActive(true);
  startSession();
  assert.deepEqual(listMessages(), []);
  assert.equal(isAlertActive(), false);
  endSession();
});

test('members are tracked per session, and a new session starts with none', () => {
  endSession();
  startSession();
  addMember('alice');
  assert.equal(isMember('alice'), true);
  assert.equal(hasSeenRole('alice'), false);
  markRoleSeen('alice');
  assert.equal(hasSeenRole('alice'), true);

  startSession();
  assert.equal(isMember('alice'), false);
  endSession();
  assert.equal(isMember('alice'), false);
});
