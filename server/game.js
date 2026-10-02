// One game, whole: its players, its phase, every rule about who may do what
// and when, and every timer. Nothing else holds game state. It knows nothing
// about connections - index.js turns phones' messages into act() calls and
// sends each phone its view (viewFor) whenever the game says it changed
// (onChange).
//
// Phases: 'lobby' until the host presses JOUER, then 'playing', with a
// 'meeting' (body report and vote) interrupting it now and then. Each phone
// action lists the phases it's allowed in (RULES below), so a new action
// can't accidentally work where it shouldn't.

import { createRoster } from './roster.js';
import { createChat } from './chatState.js';
import { createRoles } from './roleState.js';
import { createTasks, TASK_POOL } from './taskState.js';
import { tallyVotes, SKIP_VOTE } from './voteState.js';
import { defaultSettings, cleanSettings } from './settings.js';
import { cleanChatText, cleanColor, cleanHat, cleanPhoto } from './clean.js';

export const DEFAULT_TIMINGS = {
  // How long two players must keep their hands on the scanner together to
  // switch the alert off.
  handScanMs: 3000,
  // A body report: "CADAVRE TROUVÉ", then the vote, then who voted for
  // whom, then the result.
  reportMs: 5000,
  voteMs: 30_000,
  tallyMs: 5000,
  resultMs: 10_000,
  // Tests only: fixed lengths instead of the game's settings.
  alertMs: null,
  interferenceMs: null,
};

// What a phone may report for the surveillance screen: a door opened, a
// minigame finished. Never the alert or interference (only imposters
// trigger those). Tasks and the hand scanner are logged by the game itself.
export const SURVEILLANCE_ACTIONS = new Set(['door', 'sort', 'dino', 'dish', 'wires']);

// The surveillance screen has no history: it shows the latest action when
// opened, then new ones live. A few are kept so that several actions in a
// row (two players finishing the hand scanner at once) all reach it.
const RECENT_ACTIVITY = 5;

// Who may do what, and in which phases (every phase when not listed):
// - player: anyone in the game's roster (lobby or playing)
// - waiting: in the roster but not playing yet (the lobby)
// - member: playing the game (past the lobby, has a role)
// - host: the game's host
const RULES = {
  customize: { who: 'waiting' },
  updateSettings: { who: 'host', phases: ['lobby'] },
  start: { who: 'player' },
  roleSeen: { who: 'member' },
  chat: { who: 'player', phases: ['lobby', 'playing'] },
  completeTask: { who: 'member', phases: ['playing'] },
  completeRandomTask: { who: 'member', phases: ['playing'] },
  reportAction: { who: 'member', phases: ['playing'] },
  alertStart: { who: 'member', phases: ['playing'] },
  alertStop: { who: 'member', phases: ['playing'] },
  interferenceStart: { who: 'member', phases: ['playing'] },
  handPress: { who: 'member' }, // letting go always works; pressing only while playing
  declareDead: { who: 'member', phases: ['playing'] },
  reportBody: { who: 'member', phases: ['playing'] },
  castVote: { who: 'member', phases: ['meeting'] },
};

// characters: { get, save, photoUrl } (see characterStore.js) - where
// players' looks are saved, outside any game.
export function createGame({ id, name, hostId, timings = {}, characters, onChange = () => {} }) {
  const t = { ...DEFAULT_TIMINGS, ...timings };
  const roster = createRoster();
  const chat = createChat();
  const roles = createRoles();
  const tasks = createTasks();

  let host = hostId;
  let started = false;
  let settings = defaultSettings();
  // Players who have entered the game itself (past the lobby), and so have
  // a role: clientId -> { roleSeen }. Never taken away during the game -
  // leaving and coming back picks up exactly where they were. roleSeen stays
  // false until their phone has shown the role reveal, so one that was
  // asleep at JOUER gets it when it comes back.
  const members = new Map();
  // Declared themselves dead (MORT), or voted out: can't vote, can't be
  // voted for.
  const dead = new Set();
  let alert = null; // { endsAt, durationMs } while on
  let interference = null; // { endsAt } while on
  const scanner = { pressing: new Set(), endsAt: null, completedId: 0, completedBy: [] };
  let meeting = null;
  const activity = []; // the latest few surveillance actions, oldest first
  let activityCount = 0;

  // --- Timers: one place, all cancelled together when the game ends ------
  const timers = new Map();

  function schedule(key, ms, run) {
    cancel(key);
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      run();
      onChange();
    }, ms));
  }

  function cancel(key) {
    clearTimeout(timers.get(key));
    timers.delete(key);
  }

  const phase = () => {
    if (!started) return 'lobby';
    return meeting ? 'meeting' : 'playing';
  };
  const alertMs = () => t.alertMs ?? settings.alertSeconds * 1000;
  const interferenceMs = () => t.interferenceMs ?? settings.interferenceSeconds * 1000;

  // --- Alert: on for its countdown, then off by itself ---------------------
  // The bar always shows the time left out of a full alert, so an alert
  // resumed after a meeting shows the part it had left.
  function startAlert(durationMs) {
    alert = { endsAt: Date.now() + durationMs, durationMs: alertMs() };
    schedule('alert', durationMs, () => { alert = null; });
  }

  function stopAlert() {
    alert = null;
    cancel('alert');
  }

  function startInterference() {
    interference = { endsAt: Date.now() + interferenceMs() };
    schedule('interference', interferenceMs(), () => { interference = null; });
  }

  function stopInterference() {
    interference = null;
    cancel('interference');
  }

  // --- Surveillance -----------------------------------------------------
  function logActivity(clientId, action, detail = null) {
    const player = roster.get(clientId);
    if (!player) return;
    activityCount += 1;
    activity.push({
      id: activityCount,
      playerId: clientId,
      name: player.name,
      color: player.color,
      hat: player.hat,
      action,
      detail,
      at: Date.now(),
    });
    if (activity.length > RECENT_ACTIVITY) activity.shift();
  }

  // --- Hand scanner -----------------------------------------------------
  // Two or more players pressing starts the scan; anyone letting go (below
  // two) cancels it. Held long enough, it switches the alert off for the
  // whole game.
  function updateScanner() {
    if (scanner.pressing.size >= 2 && scanner.endsAt === null) {
      scanner.endsAt = Date.now() + t.handScanMs;
      schedule('scanner', t.handScanMs, () => {
        const players = Array.from(scanner.pressing);
        scanner.endsAt = null;
        scanner.pressing.clear();
        stopAlert();
        scanner.completedId += 1;
        scanner.completedBy = players;
        players.forEach((clientId) => logActivity(clientId, 'handscan'));
      });
    } else if (scanner.pressing.size < 2 && scanner.endsAt !== null) {
      scanner.endsAt = null;
      cancel('scanner');
    }
  }

  function releaseHand(clientId) {
    if (scanner.pressing.delete(clientId)) updateScanner();
  }

  function resetScanner() {
    scanner.pressing.clear();
    scanner.endsAt = null;
    cancel('scanner');
  }

  // --- Body report and vote -------------------------------------------
  // The whole game stops for it: the alert is paused (and resumed with the
  // time it had left once the vote is over), interference and the hand
  // scanner are cut.

  // Every innocent's tasks together, dead ones included - a single number,
  // so it never tells anyone who the imposters are (their tasks are fake
  // and left out).
  function crewmateProgress() {
    const players = roster.list();
    const crewmates = Array.from(members.keys()).filter((clientId) => roles.getRole(clientId, players) === 'crewmate');
    return tasks.progress(crewmates);
  }

  function setMeetingStep(step, ms, next) {
    meeting.step = step;
    meeting.endsAt = Date.now() + ms;
    meeting.durationMs = ms;
    schedule('meeting', ms, next);
  }

  function canVote(clientId) {
    return meeting.participants.some((player) => player.id === clientId) && !dead.has(clientId);
  }

  function startMeeting() {
    const pausedAlertMs = alert ? Math.max(0, alert.endsAt - Date.now()) : 0;
    stopAlert();
    stopInterference();
    resetScanner();
    // Everyone playing the game at this moment (not newcomers still in the
    // lobby), with the look they have now.
    const participants = roster.list()
      .filter((player) => members.has(player.id))
      .map(({ id: playerId, name: playerName, color, hat }) => ({ id: playerId, name: playerName, color, hat }));
    meeting = { step: null, endsAt: 0, durationMs: 0, participants, votes: new Map(), eliminatedId: null, pausedAlertMs };
    setMeetingStep('report', t.reportMs, () => setMeetingStep('vote', t.voteMs, endVote));
  }

  // First everyone sees who voted for whom; only then is the result (and
  // the eliminated player's death) revealed.
  function endVote() {
    setMeetingStep('tally', t.tallyMs, () => {
      meeting.eliminatedId = tallyVotes(meeting.votes);
      if (meeting.eliminatedId) dead.add(meeting.eliminatedId);
      setMeetingStep('result', t.resultMs, endMeeting);
    });
  }

  function endMeeting() {
    const { pausedAlertMs } = meeting;
    meeting = null;
    if (pausedAlertMs > 0) startAlert(pausedAlertMs);
  }

  // The vote ends as soon as every living player who's still connected has
  // voted - nobody waits 30 s for a phone that dropped out.
  function checkEveryoneVoted() {
    if (!meeting || meeting.step !== 'vote') return;
    const waitingFor = meeting.participants.some((player) => (
      !dead.has(player.id) && roster.get(player.id)?.online && !meeting.votes.has(player.id)
    ));
    if (!waitingFor) endVote();
  }

  // --- Phone actions ----------------------------------------------------
  // Each returns false to refuse (the phone is told), anything else is done.
  const HANDLERS = {
    // VALIDER on the lobby's customisation screen. A colour someone else in
    // the game grabbed first is refused: the player keeps their current one.
    customize(clientId, { photo, color, hat }) {
      const player = roster.get(clientId);
      const requested = cleanColor(color);
      const finalColor = requested && roster.resolveColor(clientId, requested) === requested ? requested : player.color;
      const finalHat = cleanHat(hat);
      roster.update(clientId, { color: finalColor, hat: finalHat });
      characters.save(clientId, { name: player.name, photo: cleanPhoto(photo), color: finalColor, hat: finalHat });
    },

    updateSettings(clientId, requested) {
      settings = cleanSettings(requested, settings);
    },

    // JOUER (host only, before the game has started) sends everyone in the
    // lobby into the game at once. CONTINUER (once it has started) brings in
    // just the player who pressed it, always as a crewmate.
    start(clientId) {
      if (!started) {
        if (clientId !== host) return false;
        started = true;
        const lobby = roster.list();
        roles.assignRoles(lobby, settings.imposterCount);
        tasks.assignTasks(lobby, settings.tasksPerPlayer);
        lobby.forEach((player) => members.set(player.id, { roleSeen: false }));
        return true;
      }
      if (!members.has(clientId)) {
        const players = roster.list();
        roles.getRole(clientId, players);
        tasks.getTasks(clientId, players);
        members.set(clientId, { roleSeen: false });
      }
      return true;
    },

    // The phone has shown the role reveal: from now on it goes straight to
    // the menu.
    roleSeen(clientId) {
      members.get(clientId).roleSeen = true;
    },

    chat(clientId, { text }) {
      const cleanText = cleanChatText(text);
      if (!cleanText) return false;
      const player = roster.get(clientId);
      chat.addMessage({ clientId, name: player.name, color: player.color, hat: player.hat, text: cleanText });
      return true;
    },

    // A minigame reports its own completion without knowing whether it's
    // one of this player's tasks - nothing changes if it isn't.
    completeTask(clientId, { taskId }) {
      if (!TASK_POOL.includes(taskId)) return false;
      tasks.completeTask(clientId, taskId);
      return true;
    },

    // TEST TÂCHE: marks one of the player's unfinished tasks done, at random.
    completeRandomTask(clientId) {
      const pending = tasks.getTasks(clientId, roster.list()).filter((task) => !task.done);
      if (pending.length === 0) return false;
      const task = pending[Math.floor(Math.random() * pending.length)];
      tasks.completeTask(clientId, task.id);
      logActivity(clientId, 'task', task.id);
      return true;
    },

    reportAction(clientId, { action }) {
      if (!SURVEILLANCE_ACTIONS.has(action)) return false;
      logActivity(clientId, action);
      return true;
    },

    // Restarts the countdown from full if an alert is already running.
    alertStart() {
      startAlert(alertMs());
    },

    alertStop() {
      stopAlert();
    },

    interferenceStart() {
      startInterference();
    },

    handPress(clientId, { pressing }) {
      if (!pressing) {
        releaseHand(clientId);
        return true;
      }
      if (phase() !== 'playing') return false;
      scanner.pressing.add(clientId);
      updateScanner();
      return true;
    },

    declareDead(clientId) {
      dead.add(clientId);
    },

    reportBody() {
      startMeeting();
    },

    // A vote can be changed until the vote ends. Voting for yourself is
    // allowed, for a dead player isn't. Nobody sees anyone's vote until the
    // vote is over.
    castVote(clientId, { targetId }) {
      if (meeting.step !== 'vote' || !canVote(clientId)) return false;
      if (targetId !== SKIP_VOTE && !canVote(targetId)) return false;
      meeting.votes.set(clientId, targetId);
      checkEveryoneVoted();
      return true;
    },
  };

  function allowed(clientId, { who, phases }) {
    if (!roster.get(clientId)) return false;
    if (phases && !phases.includes(phase())) return false;
    if (who === 'waiting') return !members.has(clientId);
    if (who === 'member') return members.has(clientId);
    if (who === 'host') return clientId === host;
    return true;
  }

  function act(clientId, type, payload = {}) {
    const rule = RULES[type];
    if (!rule) return { ok: false, error: 'unknown-action' };
    if (!allowed(clientId, rule)) return { ok: false, error: 'not-allowed' };
    const result = HANDLERS[type](clientId, payload || {});
    onChange();
    return result === false ? { ok: false, error: 'not-allowed' } : { ok: true };
  }

  // --- Players coming and going -------------------------------------
  // Joining (or coming back): the saved colour is kept if nobody else here
  // has it, otherwise a random free one. identity.photo undefined keeps the
  // photo already saved for this phone.
  function addPlayer(clientId, identity) {
    const color = roster.resolveColor(clientId, identity.color);
    roster.add(clientId, { name: identity.name, color, hat: identity.hat });
    const photo = identity.photo === undefined ? characters.get(clientId)?.photo ?? null : identity.photo;
    characters.save(clientId, { name: identity.name, photo, color, hat: identity.hat });
    onChange();
  }

  // A phone that dropped (still in the game, just not connected) or came
  // back. One that dropped can't still be holding the scanner.
  function setOnline(clientId, online) {
    if (!roster.get(clientId)) return;
    roster.update(clientId, { online });
    if (!online) releaseHand(clientId);
    checkEveryoneVoted();
    onChange();
  }

  // Out of the roster (left on purpose, or gone too long). Still a member if
  // they were playing, so coming back later picks up where they were. If the
  // host leaves, the player who has been here the longest takes over.
  function removePlayer(clientId) {
    if (!roster.get(clientId)) return;
    roster.remove(clientId);
    releaseHand(clientId);
    const remaining = roster.list();
    if (host === clientId && remaining.length > 0) host = remaining[0].id;
    checkEveryoneVoted();
    onChange();
  }

  // --- What each phone sees -------------------------------------------
  // Everything a phone needs to draw its screens, and nothing it shouldn't
  // know: its own role and tasks only (never anyone else's), deaths only
  // during a meeting, votes only once the vote is over. Times are absolute
  // here (endsAt); toWire turns them into "time left" when sending.
  function lookOf(player) {
    return { id: player.id, name: player.name, color: player.color, hat: player.hat, photo: characters.photoUrl(player.id) };
  }

  function meetingViewFor(clientId) {
    const withDeath = (player) => ({
      ...lookOf(player),
      dead: dead.has(player.id),
      online: Boolean(roster.get(player.id)?.online),
    });
    const eliminated = meeting.participants.find((player) => player.id === meeting.eliminatedId);
    const votesVisible = meeting.step === 'tally' || meeting.step === 'result';
    return {
      step: meeting.step,
      endsAt: meeting.endsAt,
      durationMs: meeting.durationMs,
      players: meeting.participants.map(withDeath),
      taskProgress: crewmateProgress(),
      eliminated: eliminated ? withDeath(eliminated) : null,
      votes: votesVisible ? Array.from(meeting.votes, ([voterId, targetId]) => ({ voterId, targetId })) : [],
      myVote: meeting.votes.get(clientId) ?? null,
    };
  }

  function viewFor(clientId) {
    const players = roster.list();
    const member = members.get(clientId);
    return {
      game: { id, name, hostId: host, started, settings: { ...settings } },
      players: players.map((player) => ({ ...lookOf(player), online: player.online })),
      me: member
        ? {
          member: true,
          role: roles.getRole(clientId, players),
          roleSeen: member.roleSeen,
          tasks: tasks.getTasks(clientId, players).map((task) => ({ ...task })),
        }
        : { member: false },
      alert: alert ? { active: true, endsAt: alert.endsAt, durationMs: alert.durationMs } : { active: false },
      interference: { active: Boolean(interference) },
      handScanner: {
        pressing: scanner.pressing.size,
        endsAt: scanner.endsAt,
        scanMs: t.handScanMs,
        completedId: scanner.completedId,
        completedBy: scanner.completedBy.slice(),
      },
      meeting: meeting && member ? meetingViewFor(clientId) : null,
      activity: member ? activity.map((entry) => ({ ...entry })) : [],
      chatLastId: chat.lastId(),
    };
  }

  // Chat messages after the given id, each with its sender's photo address.
  function getChat(afterId) {
    return chat.messagesAfter(afterId).map((message) => ({ ...message, photo: characters.photoUrl(message.clientId) }));
  }

  return {
    id,
    name,
    act,
    addPlayer,
    setOnline,
    removePlayer,
    viewFor,
    getChat,
    has: (clientId) => Boolean(roster.get(clientId)),
    isMember: (clientId) => members.has(clientId),
    playerIds: () => roster.list().map((player) => player.id),
    playerCount: () => roster.list().length,
    // What the REJOINDRE list shows - nothing about who's in the game.
    summary: () => ({ id, name, playerCount: roster.list().length, started }),
    dispose() {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    },
  };
}

// A view as sent to a phone: server clock times become "time left", since
// phone clocks can't be trusted to agree with the server's.
export function toWire(view, now = Date.now()) {
  const left = (endsAt) => Math.max(0, endsAt - now);
  const { endsAt: scanEndsAt, ...scanner } = view.handScanner;
  let meeting = null;
  if (view.meeting) {
    const { endsAt, ...rest } = view.meeting;
    meeting = { ...rest, remainingMs: left(endsAt) };
  }
  return {
    ...view,
    alert: view.alert.active
      ? { active: true, remainingMs: left(view.alert.endsAt), durationMs: view.alert.durationMs }
      : { active: false, remainingMs: 0, durationMs: 1 },
    handScanner: { ...scanner, scanning: scanEndsAt !== null, remainingMs: scanEndsAt === null ? 0 : left(scanEndsAt) },
    meeting,
    activity: view.activity.map(({ at, ...entry }) => ({ ...entry, agoMs: now - at })),
  };
}
