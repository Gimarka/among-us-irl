import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSettings,
  cleanSessionName,
  isSessionNameTaken,
  createSession,
  getSession,
  deleteSession,
  listSessions,
  clearSessions,
  rememberClientSession,
  getClientSession,
  isMember,
  addMember,
  hasSeenRole,
  markRoleSeen,
} from './sessionState.js';

test('names are trimmed and capped at 20 characters', () => {
  assert.equal(cleanSessionName('  Soirée  '), 'Soirée');
  assert.equal(cleanSessionName('x'.repeat(30)).length, 20);
  assert.equal(cleanSessionName(42), '');
});

test('each game gets its own id and state, and is listed until deleted', () => {
  clearSessions();
  const a = createSession('Maison', 'alice');
  const b = createSession('Jardin', 'bob');
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.chat, b.chat, 'every game has its own chat');

  a.chat.addMessage({ clientId: 'alice', name: 'Alice', text: 'salut' });
  assert.deepEqual(b.chat.listMessages(), []);

  assert.deepEqual(listSessions().map((s) => s.name), ['Maison', 'Jardin']);
  deleteSession(a.id);
  assert.equal(getSession(a.id), null);
  assert.deepEqual(listSessions().map((s) => s.name), ['Jardin']);
});

test('a name in use is taken regardless of upper/lower case, and freed on delete', () => {
  clearSessions();
  const game = createSession('Maison', 'alice');
  assert.equal(isSessionNameTaken('MAISON'), true);
  deleteSession(game.id);
  assert.equal(isSessionNameTaken('Maison'), false);
});

test('deleting a game stops its alert timer', async () => {
  clearSessions();
  const game = createSession('Maison', 'alice');
  let fired = false;
  game.alert.startAlert(() => { fired = true; }, 20);
  deleteSession(game.id);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(fired, false);
});

test('a phone is taken back to its game while in its roster or playing it', () => {
  clearSessions();
  const game = createSession('Maison', 'alice');
  rememberClientSession('alice', game.id);
  assert.equal(getClientSession('alice'), null, 'not in the roster yet');

  game.roster.addPlayer('alice', 'socket1', 'Alice');
  assert.equal(getClientSession('alice'), game);

  game.roster.removePlayer('alice', 'socket1');
  assert.equal(getClientSession('alice'), null, 'left the lobby');

  addMember(game, 'alice');
  assert.equal(getClientSession('alice'), game, 'has a role in it, even after leaving');
});

test('members are tracked per game, with whether they have seen their role', () => {
  clearSessions();
  const game = createSession('Maison', 'alice');
  addMember(game, 'alice');
  assert.equal(isMember(game, 'alice'), true);
  assert.equal(hasSeenRole(game, 'alice'), false);
  markRoleSeen(game, 'alice');
  assert.equal(hasSeenRole(game, 'alice'), true);
  assert.equal(isMember(createSession('Jardin', 'bob'), 'alice'), false);
});

test('a new game starts with the default settings', () => {
  clearSessions();
  assert.deepEqual(createSession('Maison', 'alice').settings, {
    imposterCount: 1,
    tasksPerPlayer: 6,
    alertSeconds: 60,
    interferenceSeconds: 10,
  });
});

test('settings are kept to whole steps within their range, and junk is ignored', () => {
  const current = { imposterCount: 1, tasksPerPlayer: 6, alertSeconds: 60, interferenceSeconds: 10 };
  assert.deepEqual(
    cleanSettings({ imposterCount: 9, tasksPerPlayer: 0, alertSeconds: 50, interferenceSeconds: 'abc', hacked: true }, current),
    { imposterCount: 3, tasksPerPlayer: 1, alertSeconds: 45, interferenceSeconds: 10 },
  );
  assert.deepEqual(cleanSettings(null, current), current);
});
