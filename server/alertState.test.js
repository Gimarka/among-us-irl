import test from 'node:test';
import assert from 'node:assert/strict';
import { isAlertActive, getAlertRemainingMs, startAlert, stopAlert } from './alertState.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('starting an alert makes it active with a full countdown, stopping clears both', () => {
  stopAlert();
  assert.equal(isAlertActive(), false);
  assert.equal(getAlertRemainingMs(), 0);

  startAlert(() => {}, 60_000);
  assert.equal(isAlertActive(), true);
  assert.ok(getAlertRemainingMs() > 59_000);

  stopAlert();
  assert.equal(isAlertActive(), false);
  assert.equal(getAlertRemainingMs(), 0);
});

test('the countdown running out calls onCountdownEnd once and leaves the alert on', async () => {
  stopAlert();
  let ended = 0;
  startAlert(() => { ended += 1; }, 20);
  await wait(40);
  assert.equal(ended, 1);
  assert.equal(isAlertActive(), true, 'only the bar ends - the alert keeps flashing');
  assert.equal(getAlertRemainingMs(), 0);
  stopAlert();
});

test('restarting refills the countdown, and stopping cancels it', async () => {
  stopAlert();
  let ended = 0;
  startAlert(() => { ended += 1; }, 30);
  await wait(15);
  startAlert(() => { ended += 1; }, 30);
  await wait(20);
  assert.equal(ended, 0, 'the first countdown must not fire after a restart');
  stopAlert();
  await wait(30);
  assert.equal(ended, 0, 'a stopped countdown must not fire');
});
