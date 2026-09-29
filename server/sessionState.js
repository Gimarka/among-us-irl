// Every running game ("session"), side by side and fully separate. Each one
// is created by a player choosing NOUVELLE PARTIE, is known by a name, has a
// host (the only one who can press JOUER), and owns all of its own game
// state: roster, chat, roles, tasks, alert, interference. A game is deleted
// as soon as its roster is empty.
//
// Characters (name/colour/hat/photo) deliberately don't live here - see
// characterStore.js - since they're meant to outlive any one game.

import { createRoster } from './gameState.js';
import { createChat } from './chatState.js';
import { createRoles } from './roleState.js';
import { createTasks } from './taskState.js';
import { createAlert } from './alertState.js';
import { createInterference } from './interferenceState.js';

export const MAX_SESSION_NAME_LENGTH = 20;

const sessions = new Map(); // id -> session
let lastSessionId = 0;

// clientId -> id of the game that phone last joined, so a phone opening the
// app again can be taken straight back to it (see getClientSession).
const lastSessionOfClient = new Map();

export function cleanSessionName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().slice(0, MAX_SESSION_NAME_LENGTH);
}

// Names are unique among running games, ignoring upper/lower case, so the
// REJOINDRE list never shows two games you can't tell apart.
export function isSessionNameTaken(name) {
  const wanted = name.toLowerCase();
  return Array.from(sessions.values()).some((session) => session.name.toLowerCase() === wanted);
}

export function createSession(name, hostId) {
  lastSessionId += 1;
  const session = {
    id: lastSessionId,
    name,
    hostId,
    started: false, // true once the host has pressed JOUER
    roster: createRoster(),
    chat: createChat(),
    roles: createRoles(),
    tasks: createTasks(),
    alert: createAlert(),
    interference: createInterference(),
    // Players who have entered the game itself (past the lobby), and so
    // have a role: clientId -> { roleSeen }. Never taken away during the
    // game - leaving and coming back picks up exactly where they were.
    // roleSeen stays false until their phone has actually been sent the role
    // reveal, so one that was asleep at JOUER gets it on its next connection.
    members: new Map(),
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id) {
  return sessions.get(id) || null;
}

// Stops the game's timers too, so nothing fires for a game that's gone.
export function deleteSession(id) {
  const session = sessions.get(id);
  if (!session) return;
  session.alert.stopAlert();
  session.interference.clearInterference();
  sessions.delete(id);
}

// What the REJOINDRE popup shows - nothing about who's in which game.
export function listSessions() {
  return Array.from(sessions.values()).map((session) => ({
    id: session.id,
    name: session.name,
    playerCount: session.roster.listPlayers().length,
    started: session.started,
  }));
}

export function clearSessions() {
  Array.from(sessions.keys()).forEach(deleteSession);
  lastSessionOfClient.clear();
}

export function rememberClientSession(clientId, sessionId) {
  lastSessionOfClient.set(clientId, sessionId);
}

// The game a phone should be taken back to, if any: the last one it joined,
// provided that game still exists and the phone is still part of it (in its
// lobby, or playing it - even after leaving on purpose, since its role is
// kept). A phone that left a lobby before the game started isn't.
export function getClientSession(clientId) {
  const session = sessions.get(lastSessionOfClient.get(clientId));
  if (!session) return null;
  if (session.roster.findPlayerByClientId(clientId) || session.members.has(clientId)) return session;
  return null;
}

export function isMember(session, clientId) {
  return session.members.has(clientId);
}

export function addMember(session, clientId) {
  if (!session.members.has(clientId)) session.members.set(clientId, { roleSeen: false });
}

export function hasSeenRole(session, clientId) {
  return Boolean(session.members.get(clientId)?.roleSeen);
}

export function markRoleSeen(session, clientId) {
  const member = session.members.get(clientId);
  if (member) member.roleSeen = true;
}
