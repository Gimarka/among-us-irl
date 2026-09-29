import test from 'node:test';
import assert from 'node:assert/strict';
import { tallyVotes, SKIP_VOTE } from './voteState.js';

const votes = (entries) => new Map(Object.entries(entries));

test('the player with the most votes is eliminated, even without half the votes', () => {
  assert.equal(tallyVotes(votes({ a: 'bob', b: 'bob', c: 'carol', d: 'dave' })), 'bob');
});

test('no votes, a tie, or PASSER on top eliminates nobody', () => {
  assert.equal(tallyVotes(votes({})), null);
  assert.equal(tallyVotes(votes({ a: 'bob', b: 'carol' })), null);
  assert.equal(tallyVotes(votes({ a: SKIP_VOTE, b: SKIP_VOTE, c: 'bob' })), null);
  assert.equal(tallyVotes(votes({ a: SKIP_VOTE, b: 'bob' })), null, 'PASSER tied with a player');
});
