import test from 'node:test';
import assert from 'node:assert/strict';
import { isAlertActive, setAlertActive } from './alertState.js';

test('alert starts inactive, and setAlertActive toggles it', () => {
  setAlertActive(false);
  assert.equal(isAlertActive(), false);
  assert.equal(setAlertActive(true), true);
  assert.equal(isAlertActive(), true);
  assert.equal(setAlertActive(false), false);
  assert.equal(isAlertActive(), false);
});
