// A shared, timed disruption: any player can trigger it, and after it
// expires the server itself tells everyone it's over (see the onExpire
// callback used by index.js) rather than relying on a second button click.

let interferenceActive = false;
let interferenceTimer = null;

export function isInterferenceActive() {
  return interferenceActive;
}

// Starts (or restarts, if already running) the interference window. onExpire
// is called once, when the window naturally ends - never on a manual clear.
export function startInterference(onExpire, durationMs) {
  interferenceActive = true;
  if (interferenceTimer) clearTimeout(interferenceTimer);
  interferenceTimer = setTimeout(() => {
    interferenceActive = false;
    interferenceTimer = null;
    onExpire();
  }, durationMs);
}

export function clearInterference() {
  interferenceActive = false;
  if (interferenceTimer) clearTimeout(interferenceTimer);
  interferenceTimer = null;
}
