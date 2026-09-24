// A single shared alert flag, broadcast to every connected phone so they
// all flash red together rather than just the one that triggered it - see
// the 'alertStart'/'alertStop' handlers in index.js.

let alertActive = false;

export function isAlertActive() {
  return alertActive;
}

export function setAlertActive(active) {
  alertActive = active;
  return alertActive;
}
