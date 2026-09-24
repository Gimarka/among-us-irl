import test from 'node:test';
import assert from 'node:assert/strict';
import { isInterferenceActive, startInterference, clearInterference } from './interferenceState.js';

test('startInterference is active immediately and calls onExpire once the duration passes', async () => {
  clearInterference();
  assert.equal(isInterferenceActive(), false);

  let expired = false;
  startInterference(() => { expired = true; }, 20);
  assert.equal(isInterferenceActive(), true);
  assert.equal(expired, false);

  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(isInterferenceActive(), false);
  assert.equal(expired, true);
});

test('starting again before expiry restarts the timer instead of stacking two', async () => {
  clearInterference();
  let expireCount = 0;
  startInterference(() => { expireCount += 1; }, 30);
  await new Promise((resolve) => setTimeout(resolve, 15));
  startInterference(() => { expireCount += 1; }, 30); // restarts the window
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(isInterferenceActive(), true, 'the restarted window should still be running');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(expireCount, 1, 'onExpire should only fire once, not from the superseded first call');
});

test('clearInterference cancels a pending expiry', async () => {
  clearInterference();
  let expired = false;
  startInterference(() => { expired = true; }, 20);
  clearInterference();
  assert.equal(isInterferenceActive(), false);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(expired, false, 'onExpire must not fire after a manual clear');
});
