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

// What the host can change with ⚙️ in the lobby, before JOUER. The defaults
// are how the game played before settings existed.
export const SETTINGS_LIMITS = {
  imposterCount: { min: 1, max: 3, step: 1, default: 1 },
  tasksPerPlayer: { min: 1, max: 9, step: 1, default: 6 }, // 9 = every task in the pool
  alertSeconds: { min: 20, max: 120, step: 10, default: 60 },
  interferenceSeconds: { min: 5, max: 60, step: 5, default: 10 },
};

function defaultSettings() {
  return Object.fromEntries(Object.entries(SETTINGS_LIMITS).map(([key, limit]) => [key, limit.default]));
}

// Only known settings, each a whole number of steps within its range;
// anything missing or unusable keeps its current value.
export function cleanSettings(requested, current) {
  const cleaned = { ...current };
  Object.entries(SETTINGS_LIMITS).forEach(([key, { min, max, step }]) => {
    const value = Number(requested?.[key]);
    if (!Number.isFinite(value)) return;
    const stepped = min + Math.round((value - min) / step) * step;
    cleaned[key] = Math.min(max, Math.max(min, stepped));
  });
  return cleaned;
}

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
    settings: defaultSettings(),
    roster: createRoster(),
    chat: createChat(),
    roles: createRoles(),
    tasks: createTasks(),
    alert: createAlert(),
    interference: createInterference(),
    // The hand scanner minigame: which players are pressing it right now,
    // and the timer running while at least two of them are (see index.js).
    handScanner: { pressing: new Set(), timer: null },
    // Players who are dead: declared themselves dead (MORT), or were voted
    // out. Dead players can't vote, and can't be voted for.
    dead: new Set(),
    // The body report and vote running right now, or null (see index.js).
    meeting: null,
    // What players have done, for the surveillance screen: only the latest
    // action is kept (see logActivity in index.js).
    activity: [],
    activityCount: 0, // gives each logged action its own id
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
  clearTimeout(session.handScanner.timer);
  clearTimeout(session.meeting?.timer);
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
