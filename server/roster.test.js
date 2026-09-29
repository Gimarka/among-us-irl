import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoster, SUIT_COLORS } from './roster.js';

test('players are listed in the order they arrived, online, and can be removed', () => {
  const roster = createRoster();
  roster.add('client1', { name: 'Alice', color: '#c51111', hat: 'none' });
  roster.add('client2', { name: 'Bob', color: '#132ed1', hat: 'crown' });
  assert.deepEqual(roster.list(), [
    { id: 'client1', name: 'Alice', color: '#c51111', hat: 'none', online: true },
    { id: 'client2', name: 'Bob', color: '#132ed1', hat: 'crown', online: true },
  ]);
  roster.remove('client1');
  assert.deepEqual(roster.list().map((p) => p.name), ['Bob']);
  assert.equal(roster.get('client1'), null);
});

test('the same clientId coming back replaces its entry, keeping its place, instead of adding one', () => {
  const roster = createRoster();
  roster.add('client1', { name: 'Alice', color: '#c51111', hat: 'none' });
  roster.add('client2', { name: 'Bob', color: '#132ed1', hat: 'none' });
  roster.update('client1', { online: false });
  roster.add('client1', { name: 'Alice', color: '#c51111', hat: 'none' });
  assert.deepEqual(roster.list().map((p) => [p.name, p.online]), [['Alice', true], ['Bob', true]]);
});

test('list() hands out copies, never the roster itself', () => {
  const roster = createRoster();
  roster.add('client1', { name: 'Alice', color: '#c51111', hat: 'none' });
  roster.list()[0].name = 'Mallory';
  assert.equal(roster.get('client1').name, 'Alice');
});

test('resolveColor keeps a requested colour nobody else has, and a player\'s own on reconnect', () => {
  const roster = createRoster();
  roster.add('client1', { name: 'Alice', color: '#c51111', hat: 'none' });
  assert.equal(roster.resolveColor('client2', '#132ed1'), '#132ed1');
  assert.equal(roster.resolveColor('client1', '#c51111'), '#c51111');
});

test('resolveColor never hands out a colour another player already holds', () => {
  const roster = createRoster();
  roster.add('client1', { name: 'Alice', color: '#c51111', hat: 'none' });
  roster.add('client2', { name: 'Bob', color: '#132ed1', hat: 'none' });
  const color = roster.resolveColor('client3', '#c51111');
  assert.notEqual(color, '#c51111');
  assert.notEqual(color, '#132ed1');
});

test('resolveColor gives a player with no colour yet a random free one', () => {
  const roster = createRoster();
  roster.add('client1', { name: 'Alice', color: '#c51111', hat: 'none' });
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) {
    const color = roster.resolveColor('client2', null);
    assert.ok(SUIT_COLORS.includes(color));
    assert.notEqual(color, '#c51111');
    seen.add(color);
  }
  assert.ok(seen.size > 1, 'not always the same colour');
});
