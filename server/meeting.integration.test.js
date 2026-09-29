// The body report and vote. Real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, wait, act, until, startedGame } from './testSupport.js';

const step = (phone, name, timeoutMs) => until(phone, (s) => (s.meeting?.step ?? null) === name, timeoutMs);

test('a report, then a vote everyone casts, eliminates the most voted player', async () => {
  const server = await startServer({ timings: { reportMs: 30, voteMs: 5000, tallyMs: 30, resultMs: 30 } });
  try {
    const { phones: [alice, bob, carol] } = await startedGame(server, ['Alice', 'Bob', 'Carol']);
    await act(bob, 'reportBody');
    const report = await step(alice, 'report');
    assert.equal(report.meeting.players.length, 3);
    assert.equal((await step(alice, 'vote')).meeting.taskProgress, 0, 'no task done yet');

    await act(alice, 'castVote', { targetId: 'carol' });
    await act(bob, 'castVote', { targetId: 'alice' });
    await act(bob, 'castVote', { targetId: 'carol' }); // changed their mind
    assert.equal(bob.state.meeting.myVote, 'carol');
    assert.deepEqual(alice.state.meeting.votes, [], 'votes are secret during the vote');
    await act(carol, 'castVote', { targetId: 'carol' }); // voting for yourself is allowed

    const tally = await step(carol, 'tally'); // everyone voted: no waiting for the 5 s
    assert.deepEqual(
      tally.meeting.votes.map((vote) => `${vote.voterId}>${vote.targetId}`).sort(),
      ['alice>carol', 'bob>carol', 'carol>carol'],
    );
    assert.equal(tally.meeting.eliminated, null, 'the result comes after the votes are shown');
    assert.equal(tally.meeting.players.find((p) => p.id === 'carol').dead, false);

    const { meeting } = await step(carol, 'result');
    assert.equal(meeting.eliminated.id, 'carol');
    assert.equal(meeting.eliminated.dead, true);
    await step(alice, null);
  } finally {
    server.close();
  }
});

test('dead players cannot vote or be voted for, and a tie eliminates nobody', async () => {
  const server = await startServer({ timings: { reportMs: 30, voteMs: 300, tallyMs: 30, resultMs: 30 } });
  try {
    const { phones: [alice, bob, carol] } = await startedGame(server, ['Alice', 'Bob', 'Carol']);
    await act(carol, 'declareDead');
    assert.ok(alice.state.players.every((p) => !('dead' in p)), 'a death stays secret outside a meeting');

    await act(alice, 'reportBody');
    const voting = await step(alice, 'vote');
    assert.equal(voting.meeting.players.find((p) => p.id === 'carol').dead, true);

    assert.equal((await act(carol, 'castVote', { targetId: 'alice' })).ok, false, 'dead: cannot vote');
    assert.equal((await act(alice, 'castVote', { targetId: 'carol' })).ok, false, 'cannot vote for the dead');
    await act(alice, 'castVote', { targetId: 'bob' });
    await act(bob, 'castVote', { targetId: 'alice' });
    assert.equal((await step(alice, 'result')).meeting.eliminated, null, 'one vote each');
  } finally {
    server.close();
  }
});

test('a phone that dropped out doesn\'t hold up the vote', async () => {
  const server = await startServer({ disconnectGraceMs: 5000, timings: { reportMs: 30, voteMs: 10_000, tallyMs: 30 } });
  try {
    const { phones: [alice, bob, carol] } = await startedGame(server, ['Alice', 'Bob', 'Carol']);
    await act(alice, 'reportBody');
    await step(alice, 'vote');
    await act(alice, 'castVote', { targetId: 'skip' });
    await act(bob, 'castVote', { targetId: 'skip' });
    carol.io.engine.close();

    const { meeting } = await step(alice, 'tally', 2000);
    assert.equal(meeting.players.find((p) => p.id === 'carol').online, false);
  } finally {
    server.close();
  }
});

test('the alert is paused during the report and resumes with the time it had left', async () => {
  const server = await startServer({ timings: { alertMs: 5000, reportMs: 30, voteMs: 30, tallyMs: 30, resultMs: 30 } });
  try {
    const { phones: [alice] } = await startedGame(server, ['Alice']);
    await act(alice, 'alertStart');
    await until(alice, (s) => s.alert.active);
    await wait(200); // so the time it had left is measurably less than a full alert

    await act(alice, 'reportBody');
    assert.equal((await step(alice, 'report')).alert.active, false);

    const resumed = await until(alice, (s) => !s.meeting && s.alert.active);
    assert.ok(resumed.alert.remainingMs < 4850 && resumed.alert.remainingMs > 4000, `resumed with ${resumed.alert.remainingMs} ms left`);
    assert.equal(resumed.alert.durationMs, 5000, 'the bar shows it out of a full alert');
  } finally {
    server.close();
  }
});
