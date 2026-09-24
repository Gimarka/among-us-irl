// One game session at a time. Everything that belongs to a game - chat,
// roles, tasks, alert, interference - lives in its own module, and this is
// what wipes all of it clean whenever a session starts or ends, so a new
// session never inherits anything from the last one.
//
// Characters (name/colour/hat/photo) deliberately don't live here - see
// characterStore.js - since they're meant to outlive any one session.

import { clearMessages } from './chatState.js';
import { clearRoles } from './roleState.js';
import { clearTasks } from './taskState.js';
import { setAlertActive } from './alertState.js';
import { clearInterference } from './interferenceState.js';

// Counts up for the life of the server process, never reused within it.
let lastSessionId = 0;

// null when no session is running. members: clientId -> { roleSeen }.
// roleSeen is false until the player's phone has actually been sent its role
// reveal - a player whose phone was asleep when the session started gets the
// reveal the next time they connect instead of silently missing it.
let session = null;

function resetSessionData() {
  clearMessages();
  clearRoles();
  clearTasks();
  setAlertActive(false);
  clearInterference();
}

export function startSession() {
  resetSessionData();
  lastSessionId += 1;
  session = { id: lastSessionId, members: new Map() };
  return session.id;
}

export function endSession() {
  resetSessionData();
  session = null;
}

export function getSessionId() {
  return session ? session.id : null;
}

export function isMember(clientId) {
  return Boolean(session?.members.has(clientId));
}

// Membership is never taken away during a session: a player who disconnects
// (on purpose or not) and later comes back picks up exactly where they were.
export function addMember(clientId) {
  if (!session || session.members.has(clientId)) return;
  session.members.set(clientId, { roleSeen: false });
}

export function hasSeenRole(clientId) {
  return Boolean(session?.members.get(clientId)?.roleSeen);
}

export function markRoleSeen(clientId) {
  const member = session?.members.get(clientId);
  if (member) member.roleSeen = true;
}
