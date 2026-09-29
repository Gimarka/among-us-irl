import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanGameName, isGameNameTaken, addGame, getGame, deleteGame, listGames, clearGames, rememberClientGame, getClientGame,
} from './games.js';
import { defaultSettings, cleanSettings } from './settings.js';

const characters = { get: () => null, save: () => {}, photoUrl: () => null };
const player = (name) => ({ name, color: null, hat: 'none', photo: null });

test('names are trimmed and capped at 20 characters', () => {
  assert.equal(cleanGameName('  Soirée  '), 'Soirée');
  assert.equal(cleanGameName('x'.repeat(30)).length, 20);
  assert.equal(cleanGameName(42), '');
});

test('each game gets its own id and state, and is listed until deleted', () => {
  clearGames();
  const a = addGame('Maison', 'alice', { characters });
  const b = addGame('Jardin', 'bob', { characters });
  assert.notEqual(a.id, b.id);
  a.addPlayer('alice', player('Alice'));
  assert.equal(b.playerCount(), 0, 'every game has its own roster');
  assert.deepEqual(listGames().map((game) => game.name), ['Maison', 'Jardin']);
  deleteGame(a.id);
  assert.equal(getGame(a.id), null);
  assert.deepEqual(listGames().map((game) => game.name), ['Jardin']);
});

test('a name in use is taken regardless of upper/lower case, and freed on delete', () => {
  clearGames();
  const game = addGame('Maison', 'alice', { characters });
  assert.equal(isGameNameTaken('MAISON'), true);
  deleteGame(game.id);
  assert.equal(isGameNameTaken('Maison'), false);
});

test('deleting a game stops its timers', async () => {
  clearGames();
  let changes = 0;
  const game = addGame('Maison', 'alice', { characters, timings: { alertMs: 20 }, onChange: () => { changes += 1; } });
  game.addPlayer('alice', player('Alice'));
  game.act('alice', 'start');
  game.act('alice', 'alertStart');
  const before = changes;
  deleteGame(game.id);
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(changes, before, 'the alert never ran out for a deleted game');
});

test('a phone is taken back to its game while in its roster or playing it', () => {
  clearGames();
  const game = addGame('Maison', 'alice', { characters });
  rememberClientGame('alice', game.id);
  assert.equal(getClientGame('alice'), null, 'not in the roster yet');

  game.addPlayer('alice', player('Alice'));
  assert.equal(getClientGame('alice'), game);
  game.removePlayer('alice');
  assert.equal(getClientGame('alice'), null, 'left the lobby');

  game.addPlayer('alice', player('Alice'));
  game.act('alice', 'start');
  game.removePlayer('alice');
  assert.equal(getClientGame('alice'), game, 'has a role in it, even after leaving');
});

test('a new game starts with the default settings', () => {
  assert.deepEqual(defaultSettings(), { imposterCount: 1, tasksPerPlayer: 6, alertSeconds: 60, interferenceSeconds: 10 });
});

test('settings are kept to whole steps within their range, and junk is ignored', () => {
  const current = { imposterCount: 1, tasksPerPlayer: 6, alertSeconds: 60, interferenceSeconds: 10 };
  assert.deepEqual(
    cleanSettings({ imposterCount: 9, tasksPerPlayer: 0, alertSeconds: 55, interferenceSeconds: 'abc', hacked: true }, current),
    { imposterCount: 3, tasksPerPlayer: 1, alertSeconds: 60, interferenceSeconds: 10 },
  );
  assert.deepEqual(cleanSettings(null, current), current);
});
