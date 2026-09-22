import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPlayer,
  removePlayer,
  listPlayers,
  findPlayerByClientId,
  clearPlayers,
  resolveColor,
} from './gameState.js';

test('addPlayer adds a player and returns the full list', () => {
  clearPlayers();
  const result = addPlayer('client1', 'socket1', 'Alice');
  assert.deepEqual(result, [{ id: 'client1', name: 'Alice', photo: null, color: null, hat: null }]);
});

test('addPlayer keeps the selfie it was given', () => {
  clearPlayers();
  const photo = 'data:image/jpeg;base64,abc';
  const result = addPlayer('client1', 'socket1', 'Alice', photo);
  assert.equal(result[0].photo, photo);
});

test('two players joining both appear in the list', () => {
  clearPlayers();
  addPlayer('client1', 'socket1', 'Alice');
  const result = addPlayer('client2', 'socket2', 'Bob');
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((p) => p.name).sort(), ['Alice', 'Bob']);
});

test('removePlayer takes a player out of the list', () => {
  clearPlayers();
  addPlayer('client1', 'socket1', 'Alice');
  addPlayer('client2', 'socket2', 'Bob');
  const result = removePlayer('client1', 'socket1');
  assert.deepEqual(result, [{ id: 'client2', name: 'Bob', photo: null, color: null, hat: null }]);
});

test('the same clientId rejoining under a new socket replaces the old entry, not adds one', () => {
  clearPlayers();
  addPlayer('client1', 'socket1', 'Alice');
  const result = addPlayer('client1', 'socket2', 'Alice'); // e.g. a second tab, same saved identity
  assert.equal(result.length, 1);
  assert.equal(findPlayerByClientId('client1').socketId, 'socket2');
});

test('removePlayer ignores a stale disconnect from a connection that was since replaced', () => {
  clearPlayers();
  addPlayer('client1', 'socket1', 'Alice');
  addPlayer('client1', 'socket2', 'Alice'); // same player reconnects under a new socket
  const result = removePlayer('client1', 'socket1'); // the old socket's disconnect arrives late
  assert.deepEqual(
    result,
    [{ id: 'client1', name: 'Alice', photo: null, color: null, hat: null }],
    'still present - the stale disconnect must not remove the current connection',
  );
});

test('listPlayers reflects current state without mutating it', () => {
  clearPlayers();
  addPlayer('client1', 'socket1', 'Alice');
  const a = listPlayers();
  const b = listPlayers();
  assert.deepEqual(a, b);
});

test('resolveColor keeps a requested colour nobody else has', () => {
  clearPlayers();
  addPlayer('client1', 'socket1', 'Alice', null, '#c51111');
  assert.equal(resolveColor('client2', '#132ed1'), '#132ed1');
});

test('resolveColor swaps a colour that is already taken for a free one', () => {
  clearPlayers();
  addPlayer('client1', 'socket1', 'Alice', null, '#c51111');
  const color = resolveColor('client2', '#c51111');
  assert.notEqual(color, '#c51111');
});

test('resolveColor lets a player keep their own colour on reconnect', () => {
  clearPlayers();
  addPlayer('client1', 'socket1', 'Alice', null, '#c51111');
  assert.equal(resolveColor('client1', '#c51111'), '#c51111');
});

test('resolveColor never hands out a colour two different players already hold', () => {
  clearPlayers();
  addPlayer('client1', 'socket1', 'Alice', null, '#c51111');
  addPlayer('client2', 'socket2', 'Bob', null, '#132ed1');
  const color = resolveColor('client3', '#c51111');
  assert.notEqual(color, '#c51111');
  assert.notEqual(color, '#132ed1');
});
