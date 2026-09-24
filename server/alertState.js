// A single shared alert, broadcast to every connected phone so they all
// flash red together rather than just the one that triggered it - see the
// 'alertStart'/'alertStop' handlers in index.js.
//
// Starting an alert also starts a countdown, shown on every phone as a
// depleting bar. The server owns it: phones are only ever told how much time
// is left, never a clock time, since their own clocks can't be trusted.
// The countdown running out ends the alert entirely, same as ALERT STOP.

let alertActive = false;
let countdownEndsAt = null; // server clock, ms
let countdownTimer = null;

export function isAlertActive() {
  return alertActive;
}

export function getAlertRemainingMs() {
  if (!alertActive || countdownEndsAt === null) return 0;
  return Math.max(0, countdownEndsAt - Date.now());
}

// Starts (or restarts, if already running) the alert with a full countdown.
// When the countdown naturally runs out the alert stops, then onCountdownEnd
// is called once - never after a manual stop or a restart.
export function startAlert(onCountdownEnd, durationMs) {
  alertActive = true;
  countdownEndsAt = Date.now() + durationMs;
  if (countdownTimer) clearTimeout(countdownTimer);
  countdownTimer = setTimeout(() => {
    stopAlert();
    onCountdownEnd();
  }, durationMs);
}

export function stopAlert() {
  alertActive = false;
  countdownEndsAt = null;
  if (countdownTimer) clearTimeout(countdownTimer);
  countdownTimer = null;
}
