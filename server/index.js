import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { TASK_POOL } from './taskState.js';
import {
  cleanSettings,
  cleanSessionName,
  isSessionNameTaken,
  createSession,
  getSession,
  deleteSession,
  listSessions,
  rememberClientSession,
  getClientSession,
  isMember,
  addMember,
  hasSeenRole,
  markRoleSeen,
} from './sessionState.js';
import { saveCharacter, getCharacter } from './characterStore.js';


// How long two players must keep their hands on the scanner together to
// switch the alert off.
const HAND_SCAN_MS = 3000;

// How long a phone has to confirm it received its role reveal. No answer
// means the role never got there (a connection that looked alive but wasn't),
// so it's sent again when the phone comes back.
const ROLE_ACK_TIMEOUT_MS = 10_000;

// Selfies arrive already shrunk and JPEG-compressed by the phone (a 160px
// square is a few KB). This cap only exists so a malformed or oversized
// payload can't sit in memory; the photo is dropped, the player still joins.
const MAX_PHOTO_LENGTH = 100_000;
const PHOTO_PREFIX = 'data:image/jpeg;base64,';

function cleanPhoto(photo) {
  if (typeof photo !== 'string') return null;
  if (!photo.startsWith(PHOTO_PREFIX)) return null;
  if (photo.length > MAX_PHOTO_LENGTH) return null;
  return photo;
}

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

// null when missing or malformed: the game then picks a random free colour
// for the player (see resolveColor in gameState.js).
function cleanColor(color) {
  if (typeof color !== 'string') return null;
  return COLOR_PATTERN.test(color) ? color.toLowerCase() : null;
}

const DEFAULT_HAT = 'none';
const HAT_PATTERN = /^[a-z]{1,20}$/;

function cleanHat(hat) {
  if (typeof hat !== 'string') return DEFAULT_HAT;
  return HAT_PATTERN.test(hat) ? hat : DEFAULT_HAT;
}

// Matches the client's input maxlength (see CHAT_MAX_LENGTH in main.js) -
// this is the enforced copy, that one's just so the phone's keyboard stops
// early instead of typing into the void.
const MAX_CHAT_LENGTH = 300;

function cleanChatText(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0, MAX_CHAT_LENGTH);
}

// The browser makes this up once and keeps it in localStorage; it's what
// lets a reconnecting phone be recognised as the same player rather than a
// new one. A missing or malformed one (an older client, a bad payload)
// falls back to this connection's own socket id, which just means this
// particular join won't be merged with any other connection.
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function cleanClientId(clientId, fallback) {
  return typeof clientId === 'string' && CLIENT_ID_PATTERN.test(clientId) ? clientId : fallback;
}

// Who a phone says it is when it creates or joins a game.
function cleanIdentity({ clientId, name, photo, color, hat } = {}, socketId) {
  return {
    clientId: cleanClientId(clientId, socketId),
    name: String(name || '').trim().slice(0, 20) || 'Joueur',
    photo: cleanPhoto(photo),
    color: cleanColor(color),
    hat: cleanHat(hat),
  };
}

// A dropped connection - phone locked, tab backgrounded, Wi-Fi hiccup - looks
// identical to actually leaving from here, and reconnecting after any of
// those is already handled client-side (it re-joins with the same clientId).
// So an unexpected disconnect doesn't remove the player right away: they
// stay in the shared roster, with this long to reconnect before they're
// actually treated as gone.
const DISCONNECT_GRACE_MS = 15 * 60 * 1000;

// Reasons Socket.IO reports when *we* end the connection on purpose, rather
// than it failing underneath us - the logout button (client-initiated) and
// evicting a since-replaced connection (server-initiated, see
// enterSession below). Both mean the player is definitely not coming back on
// this connection, so there's nothing to wait out.
const IMMEDIATE_DISCONNECT_REASONS = new Set([
  'client namespace disconnect',
  'server namespace disconnect',
]);

export function createGameServer({
  disconnectGraceMs = DISCONNECT_GRACE_MS,
  // Tests only: short fixed durations instead of each game's settings, so a
  // test doesn't have to wait out a real alert or interference.
  interferenceDurationMs = null,
  alertCountdownMs = null,
  handScanMs = HAND_SCAN_MS,
} = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }, // dev only; tighten before real deployment
    // How often the server checks each phone is still there (Socket.IO's
    // default is 25 s). A phone that doesn't answer within pingTimeout (20 s
    // by default) after that is treated as disconnected.
    pingInterval: 60_000,
  });

  app.get('/health', (req, res) => {
    res.json({ ok: true, sessions: listSessions().length });
  });

  // clientId -> pending removal timer, for players riding out the grace
  // period above. A phone is in at most one game's roster at a time, so one
  // entry per clientId is enough.
  const pendingRemovals = new Map();

  function cancelPendingRemoval(clientId) {
    const timer = pendingRemovals.get(clientId);
    if (timer) clearTimeout(timer);
    pendingRemovals.delete(clientId);
  }

  // Each game broadcasts only to its own Socket.IO room, so nothing - an
  // alert, a chat message, the roster - ever reaches another game.
  const roomOf = (session) => `session:${session.id}`;

  function sessionInfo(session) {
    return {
      sessionId: session.id,
      name: session.name,
      hostId: session.hostId,
      started: session.started,
      settings: session.settings,
    };
  }

  const alertMs = (session) => alertCountdownMs ?? session.settings.alertSeconds * 1000;
  const interferenceMs = (session) => interferenceDurationMs ?? session.settings.interferenceSeconds * 1000;

  // What a phone needs to show the alert: whether it's flashing, and the
  // countdown bar's time left out of its full length.
  function alertPayload(session) {
    return {
      active: session.alert.isAlertActive(),
      remainingMs: session.alert.getAlertRemainingMs(),
      durationMs: alertMs(session),
    };
  }

  // The REJOINDRE list, pushed to every phone whenever a game appears,
  // disappears, starts or changes size, so an open list stays live.
  function broadcastSessionList() {
    io.emit('sessions', listSessions());
  }

  function currentSession(socket) {
    return getSession(socket.data.sessionId);
  }

  // Private: only ever to that player's own socket. The role only counts as
  // seen once the phone confirms it got it: a phone that was asleep or had
  // just lost its connection (even one the server still thinks is connected)
  // stays unseen, and gets the reveal - which is what takes it out of the
  // lobby - the next time it joins, instead of being left stuck there.
  function sendRole(session, clientId) {
    const player = session.roster.findPlayerByClientId(clientId);
    const playerSocket = player && io.sockets.sockets.get(player.socketId);
    if (!playerSocket) return;
    const players = session.roster.listPlayers();
    const payload = {
      role: session.roles.getRole(clientId, players),
      tasks: session.tasks.getTasks(clientId, players),
    };
    playerSocket.timeout(ROLE_ACK_TIMEOUT_MS).emit('role', payload, (err) => {
      if (!err) markRoleSeen(session, clientId);
    });
  }

  // Takes a player out of a game's roster (unless socketId is a connection
  // that's since been replaced - see removePlayer). The game is deleted once
  // nobody is left; if the host is the one leaving, the player who has been
  // in the game the longest takes over.
  function removeFromRoster(session, clientId, socketId) {
    const entry = session.roster.findPlayerByClientId(clientId);
    const removed = Boolean(entry) && entry.socketId === socketId;
    const players = session.roster.removePlayer(clientId, socketId);

    if (players.length === 0) {
      deleteSession(session.id);
    } else {
      io.to(roomOf(session)).emit('players', players);
      if (removed && session.hostId === clientId) {
        session.hostId = players[0].id;
        io.to(roomOf(session)).emit('session', sessionInfo(session));
      }
    }
    broadcastSessionList();
  }

  // Hand scanner: tells the game how many players are pressing, and whether
  // the scan is running (so the phones can show its progress bar).
  function broadcastHandScanner(session) {
    io.to(roomOf(session)).emit('handScanner', {
      pressing: session.handScanner.pressing.size,
      scanning: session.handScanner.timer !== null,
      scanMs: handScanMs,
    });
  }

  // Two or more players pressing starts the scan; anyone letting go (below
  // two) cancels it. Held long enough, it switches the alert off for the
  // whole game and tells the players who did it.
  function updateHandScanner(session) {
    const scanner = session.handScanner;
    if (scanner.pressing.size >= 2 && scanner.timer === null) {
      scanner.timer = setTimeout(() => {
        scanner.timer = null;
        const players = Array.from(scanner.pressing);
        scanner.pressing.clear();
        session.alert.stopAlert();
        io.to(roomOf(session)).emit('alert', alertPayload(session));
        io.to(roomOf(session)).emit('handScanComplete', { players });
        broadcastHandScanner(session);
      }, handScanMs);
    } else if (scanner.pressing.size < 2 && scanner.timer !== null) {
      clearTimeout(scanner.timer);
      scanner.timer = null;
    }
    broadcastHandScanner(session);
  }

  // A phone that leaves or drops can't still be holding the scanner.
  function releaseHand(session, clientId) {
    if (session.handScanner.pressing.delete(clientId)) updateHandScanner(session);
  }

  function leaveCurrentSession(socket) {
    const session = currentSession(socket);
    socket.data.sessionId = null;
    if (!session) return;
    socket.leave(roomOf(session));
    releaseHand(session, socket.data.clientId);
    cancelPendingRemoval(socket.data.clientId);
    removeFromRoster(session, socket.data.clientId, socket.id);
  }

  // Puts this connection into a game's lobby - or straight back into the
  // game itself for a player who already has a role in it.
  function enterSession(socket, session, identity) {
    const id = identity.clientId;
    if (socket.data.sessionId !== null && socket.data.sessionId !== undefined && socket.data.sessionId !== session.id) {
      leaveCurrentSession(socket);
    }

    // Reconnecting before the grace period ran out means they never really left.
    cancelPendingRemoval(id);

    // A phone plays one game at a time: if it's still listed in another one
    // (another tab, or an old connection riding out its grace period), it
    // leaves that one now.
    const previous = getClientSession(id);
    const stale = previous && previous.id !== session.id ? previous.roster.findPlayerByClientId(id) : null;
    if (stale) {
      removeFromRoster(previous, id, stale.socketId);
      io.sockets.sockets.get(stale.socketId)?.disconnect(true);
    }

    // The same player can briefly hold two live connections in this game -
    // a second tab, a phone that reconnected under a fresh socket just
    // before its old one timed out. Only one should count, so the previous
    // connection gets closed below. That has to happen *after* the roster
    // already reflects the new connection: disconnect() can fire its
    // 'disconnect' handler synchronously, and that handler's stale-connection
    // check (see removePlayer) only stays correct if this new entry is
    // already in place by the time it runs.
    const existing = session.roster.findPlayerByClientId(id);
    const previousSocketId = existing && existing.socketId !== socket.id ? existing.socketId : null;

    const character = {
      name: identity.name,
      photo: identity.photo,
      color: session.roster.resolveColor(id, identity.color),
      hat: identity.hat,
    };
    saveCharacter(id, character);
    socket.data.clientId = id;
    socket.data.sessionId = session.id;
    socket.join(roomOf(session));
    const players = session.roster.addPlayer(id, socket.id, character.name, character.photo, character.color, character.hat);
    rememberClientSession(id, session.id);
    io.to(roomOf(session)).emit('players', players);

    if (previousSocketId) {
      io.sockets.sockets.get(previousSocketId)?.disconnect(true);
    }

    socket.emit('joined', { ...sessionInfo(session), inGame: isMember(session, id) });
    socket.emit('chatHistory', session.chat.listMessages());
    socket.emit('alert', alertPayload(session));
    socket.emit('interference', { active: session.interference.isInterferenceActive() });

    // A returning player skips the lobby: their role reveal if they never
    // got it, otherwise just their task list to pick up from.
    if (isMember(session, id)) {
      if (hasSeenRole(session, id)) socket.emit('tasks', session.tasks.getTasks(id, session.roster.listPlayers()));
      else sendRole(session, id);
    }
    broadcastSessionList();
  }

  io.on('connection', (socket) => {
    socket.data.sessionId = null;
    socket.emit('sessions', listSessions());

    // The first thing a phone asks: what did its character look like last
    // time, and is it still part of a running game it should go back to.
    socket.on('hello', ({ clientId } = {}) => {
      const id = cleanClientId(clientId, socket.id);
      const session = getClientSession(id);
      socket.emit('welcome', {
        character: getCharacter(id),
        resume: session ? { sessionId: session.id, inGame: isMember(session, id) } : null,
      });
      socket.emit('sessions', listSessions());
    });

    // NOUVELLE PARTIE: a new, named game, with its creator as host.
    socket.on('createSession', (payload = {}) => {
      const identity = cleanIdentity(payload, socket.id);
      const name = cleanSessionName(payload.sessionName);
      if (!name) {
        socket.emit('sessionError', { reason: 'name-empty' });
        return;
      }
      if (isSessionNameTaken(name)) {
        socket.emit('sessionError', { reason: 'name-taken' });
        return;
      }
      enterSession(socket, createSession(name, identity.clientId), identity);
    });

    // REJOINDRE: one of the games from the list.
    socket.on('joinSession', (payload = {}) => {
      const session = getSession(payload.sessionId);
      if (!session) {
        socket.emit('sessionError', { reason: 'not-found' });
        return;
      }
      enterSession(socket, session, cleanIdentity(payload, socket.id));
    });

    // Back to the character screen. The player keeps their role in a game
    // that has started (so they can come back to it), but not their place
    // in a lobby.
    socket.on('leaveSession', () => {
      leaveCurrentSession(socket);
    });

    // VALIDER on the lobby's customisation screen. Only while waiting in the
    // lobby - once in the game, a look is fixed. A colour someone else in the
    // game grabbed first is refused: the player keeps their current one.
    socket.on('customize', ({ photo, color, hat } = {}) => {
      const session = currentSession(socket);
      const id = socket.data.clientId;
      const player = session?.roster.findPlayerByClientId(id);
      if (!player || isMember(session, id)) return;

      const requested = cleanColor(color);
      const finalColor = requested && session.roster.resolveColor(id, requested) === requested ? requested : player.color;
      const character = { name: player.name, photo: cleanPhoto(photo), color: finalColor, hat: cleanHat(hat) };
      saveCharacter(id, character);
      const players = session.roster.addPlayer(id, player.socketId, character.name, character.photo, character.color, character.hat);
      io.to(roomOf(session)).emit('players', players);
    });

    // The sender's name/colour/hat/photo are snapshotted from the roster
    // onto the message itself rather than looked up again on every render -
    // a message keeps showing who its sender was at the time, even if that
    // player later changes their look or leaves.
    socket.on('chatMessage', ({ text } = {}) => {
      const session = currentSession(socket);
      const player = session?.roster.findPlayerByClientId(socket.data.clientId);
      if (!player) return;

      const cleanText = cleanChatText(text);
      if (!cleanText) return;

      const message = session.chat.addMessage({
        clientId: player.id,
        name: player.name,
        photo: player.photo,
        color: player.color,
        hat: player.hat,
        text: cleanText,
      });
      io.to(roomOf(session)).emit('chatMessage', message);
    });

    // ⚙️ in the lobby: the host adjusting this game's settings, only before
    // JOUER. Everyone in the game hears the new values.
    socket.on('updateSettings', (requested = {}) => {
      const session = currentSession(socket);
      if (!session || session.started || session.hostId !== socket.data.clientId) return;
      session.settings = cleanSettings(requested, session.settings);
      io.to(roomOf(session)).emit('session', sessionInfo(session));
    });

    // JOUER (host only, before the game has started) sends everyone in the
    // lobby into the game at once. CONTINUER (once it has started) brings in
    // just the player who pressed it, as a crewmate (see getRole).
    socket.on('startGame', () => {
      const session = currentSession(socket);
      const id = socket.data.clientId;
      if (!session || !id) return;

      if (!session.started) {
        if (session.hostId !== id) return;
        session.started = true;
        const lobby = session.roster.listPlayers();
        session.roles.assignRoles(lobby, session.settings.imposterCount);
        session.tasks.assignTasks(lobby, session.settings.tasksPerPlayer);
        lobby.forEach((player) => addMember(session, player.id));
        io.to(roomOf(session)).emit('session', sessionInfo(session));
        broadcastSessionList();
        lobby.forEach((player) => sendRole(session, player.id));
        return;
      }

      addMember(session, id);
      // A second tap must not replay a reveal the player already got.
      if (!hasSeenRole(session, id)) sendRole(session, id);
    });

    // A minigame reports its own completion without knowing whether it's
    // actually one of this player's assigned tasks - completeTask is a
    // no-op if it isn't, so nothing else needs to check that here.
    socket.on('completeTask', ({ taskId } = {}) => {
      const session = currentSession(socket);
      if (!session || !TASK_POOL.includes(taskId)) return;
      const tasks = session.tasks.completeTask(socket.data.clientId, taskId);
      if (tasks) socket.emit('tasks', tasks);
    });

    // To every phone in the game, triggering player included. Restarts the
    // countdown from full if an alert is already running. When it runs out,
    // the server itself ends the alert for everyone.
    socket.on('alertStart', () => {
      const session = currentSession(socket);
      if (!session) return;
      session.alert.startAlert(() => io.to(roomOf(session)).emit('alert', alertPayload(session)), alertMs(session));
      io.to(roomOf(session)).emit('alert', alertPayload(session));
    });

    socket.on('alertStop', () => {
      const session = currentSession(socket);
      if (!session) return;
      session.alert.stopAlert();
      io.to(roomOf(session)).emit('alert', alertPayload(session));
    });

    // Same as alert: every phone in the game loses its scanner/task list at
    // once, and the server's own timer turns it back off.
    socket.on('interferenceStart', () => {
      const session = currentSession(socket);
      if (!session) return;
      session.interference.startInterference(
        () => io.to(roomOf(session)).emit('interference', { active: false }),
        interferenceMs(session),
      );
      io.to(roomOf(session)).emit('interference', { active: true });
    });

    socket.on('handPress', ({ pressing } = {}) => {
      const session = currentSession(socket);
      const id = socket.data.clientId;
      if (!session || !session.roster.findPlayerByClientId(id)) return;
      if (pressing) session.handScanner.pressing.add(id);
      else session.handScanner.pressing.delete(id);
      updateHandScanner(session);
    });

    socket.on('disconnect', (reason) => {
      const id = socket.data.clientId;
      const session = currentSession(socket);
      if (!id || !session) return; // wasn't in a game
      releaseHand(session, id);

      if (IMMEDIATE_DISCONNECT_REASONS.has(reason)) {
        removeFromRoster(session, id, socket.id);
        return;
      }

      // Only this connection's own entry rides out the grace period - a
      // connection that's already been replaced has nothing left to remove.
      if (session.roster.findPlayerByClientId(id)?.socketId !== socket.id) return;
      cancelPendingRemoval(id);
      const timer = setTimeout(() => {
        pendingRemovals.delete(id);
        const stillThere = getSession(session.id);
        if (stillThere) removeFromRoster(stillThere, id, socket.id);
      }, disconnectGraceMs);
      pendingRemovals.set(id, timer);
    });
  });

  return { httpServer, io };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const PORT = process.env.PORT || 3000;
  const { httpServer } = createGameServer();
  httpServer.listen(PORT, () => {
    console.log(`Game server listening on port ${PORT}`);
  });
}
