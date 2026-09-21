import test from 'node:test';
import assert from 'node:assert/strict';
import { addPlayer, removePlayer, listPlayers, clearPlayers } from './gameState.js';

test('addPlayer adds a player and returns the full list', () => {
  clearPlayers();
  const result = addPlayer('socket1', 'Alice');
  assert.deepEqual(result, [{ id: 'socket1', name: 'Alice', photo: null }]);
});

test('addPlayer keeps the selfie it was given', () => {
  clearPlayers();
  const photo = 'data:image/jpeg;base64,abc';
  const result = addPlayer('socket1', 'Alice', photo);
  assert.equal(result[0].photo, photo);
});

test('two players joining both appear in the list', () => {
  clearPlayers();
  addPlayer('socket1', 'Alice');
  const result = addPlayer('socket2', 'Bob');
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((p) => p.name).sort(), ['Alice', 'Bob']);
});

test('removePlayer takes a player out of the list', () => {
  clearPlayers();
  addPlayer('socket1', 'Alice');
  addPlayer('socket2', 'Bob');
  const result = removePlayer('socket1');
  assert.deepEqual(result, [{ id: 'socket2', name: 'Bob', photo: null }]);
});

test('listPlayers reflects current state without mutating it', () => {
  clearPlayers();
  addPlayer('socket1', 'Alice');
  const a = listPlayers();
  const b = listPlayers();
  assert.deepEqual(a, b);
});
