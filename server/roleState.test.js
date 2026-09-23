import test from 'node:test';
import assert from 'node:assert/strict';
import { assignRoles, getRole, clearRoles } from './roleState.js';

function players(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `client${i}` }));
}

test('assignRoles gives everyone a role and always at least one imposter', () => {
  const roles = assignRoles(players(4));
  assert.equal(roles.size, 4);
  const values = Array.from(roles.values());
  assert.ok(values.every((role) => role === 'crewmate' || role === 'imposter'));
  assert.ok(values.includes('imposter'));
});

test('4 players always get exactly one imposter', () => {
  for (let i = 0; i < 30; i += 1) {
    const roles = assignRoles(players(4));
    const imposterCount = Array.from(roles.values()).filter((role) => role === 'imposter').length;
    assert.equal(imposterCount, 1);
  }
});

test('5 and 6 players get either one or two imposters, never more', () => {
  for (const count of [5, 6]) {
    for (let i = 0; i < 30; i += 1) {
      const roles = assignRoles(players(count));
      const imposterCount = Array.from(roles.values()).filter((role) => role === 'imposter').length;
      assert.ok(imposterCount === 1 || imposterCount === 2, `expected 1 or 2, got ${imposterCount}`);
    }
  }
});

test('getRole draws once and returns the same role on repeated calls', () => {
  clearRoles();
  const roster = players(4);
  const first = getRole('client0', roster);
  const second = getRole('client0', roster);
  assert.equal(first, second);
});

test('getRole keeps every player consistent with a single shared draw', () => {
  clearRoles();
  const roster = players(6);
  const roles = roster.map((player) => getRole(player.id, roster));
  const imposterCount = roles.filter((role) => role === 'imposter').length;
  assert.ok(imposterCount === 1 || imposterCount === 2);
});

test('a player who joins after the round started falls back to crewmate', () => {
  clearRoles();
  const roster = players(4);
  roster.forEach((player) => getRole(player.id, roster));
  const latecomerRole = getRole('client-latecomer', roster);
  assert.equal(latecomerRole, 'crewmate');
});

test('clearRoles resets the draw for the next round', () => {
  clearRoles();
  const roster = players(4);
  getRole('client0', roster);
  clearRoles();
  const roles = assignRoles(players(4));
  assert.equal(roles.size, 4);
});
