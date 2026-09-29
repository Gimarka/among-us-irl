// One game's interference (see sessionState.js - every game gets its own):
// a timed disruption any player can trigger, and after it expires the
// server itself tells everyone it's over (see the onExpire callback used by
// index.js) rather than relying on a second button click.

export function createInterference() {
  let interferenceActive = false;
  let interferenceTimer = null;

  function clearInterference() {
    interferenceActive = false;
    if (interferenceTimer) clearTimeout(interferenceTimer);
    interferenceTimer = null;
  }

  return {
    isInterferenceActive() {
      return interferenceActive;
    },

    // Starts (or restarts, if already running) the interference window.
    // onExpire is called once, when the window naturally ends - never on a
    // manual clear.
    startInterference(onExpire, durationMs) {
      interferenceActive = true;
      if (interferenceTimer) clearTimeout(interferenceTimer);
      interferenceTimer = setTimeout(() => {
        interferenceActive = false;
        interferenceTimer = null;
        onExpire();
      }, durationMs);
    },

    clearInterference,
  };
}
