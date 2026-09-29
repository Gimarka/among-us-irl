// The body report and vote. Real HTTP server, real sockets.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, waitForEvent, createGame, joinGame } from './testSupport.js';

function waitForPhase(socket, phase) {
  return new Promise((resolve) => {
    socket.on('meeting', function listener(payload) {
      if (payload.phase !== phase) return;
      socket.off('meeting', listener);
      resolve(payload);
    });
  });
}

// Three players past JOUER, in the game.
async function startedGame(server) {
  const names = ['alice', 'bob', 'carol'];
  const sockets = [];
  let sessionId;
  for (const id of names) {
    const socket = await server.connect();
    const player = { clientId: id, name: id };
    if (!sessionId) ({ sessionId } = await createGame(socket, 'Maison', player));
    else await joinGame(socket, sessionId, player);
    sockets.push(socket);
  }
  const roles = sockets.map((socket) => waitForEvent(socket, 'role'));
  sockets[0].emit('startGame');
  await Promise.all(roles);
  return sockets;
}

test('a report, then a vote everyone casts, eliminates the most voted player', async () => {
  const server = await startServer({ reportMs: 30, voteMs: 5000, tallyMs: 30, resultMs: 30 });
  try {
    const [alice, bob, carol] = await startedGame(server);
    const report = waitForPhase(alice, 'report');
    const voting = waitForPhase(alice, 'vote');
    bob.emit('reportBody');
    assert.equal((await report).players.length, 3);
    assert.equal((await voting).taskProgress, 0, 'no task done yet');

    const tally = waitForPhase(carol, 'tally');
    const result = waitForPhase(carol, 'result');
    alice.emit('castVote', { targetId: 'carol' });
    bob.emit('castVote', { targetId: 'alice' });
    bob.emit('castVote', { targetId: 'carol' }); // changed their mind
    carol.emit('castVote', { targetId: 'carol' }); // voting for yourself is allowed
    const { votes, eliminated: notYet, players } = await tally; // everyone voted: no waiting for the 5 s
    assert.deepEqual(votes.map((vote) => `${vote.voterId}>${vote.targetId}`).sort(), ['alice>carol', 'bob>carol', 'carol>carol']);
    assert.equal(notYet, null, 'the result comes after the votes are shown');
    assert.equal(players.find((player) => player.id === 'carol').dead, false);
    const { eliminated } = await result;
    assert.equal(eliminated.id, 'carol');
    assert.equal(eliminated.dead, true);

    await waitForPhase(alice, null);
  } finally {
    server.close();
  }
});

test('dead players cannot vote or be voted for, and a tie eliminates nobody', async () => {
  const server = await startServer({ reportMs: 30, voteMs: 300, tallyMs: 30, resultMs: 30 });
  try {
    const [alice, bob, carol] = await startedGame(server);
    carol.emit('declareDead');
    const voting = waitForPhase(alice, 'vote');
    alice.emit('reportBody');
    const { players } = await voting;
    assert.equal(players.find((player) => player.id === 'carol').dead, true);

    const result = waitForPhase(alice, 'result');
    carol.emit('castVote', { targetId: 'alice' }); // dead: ignored
    alice.emit('castVote', { targetId: 'carol' }); // for a dead player: ignored
    alice.emit('castVote', { targetId: 'bob' });
    bob.emit('castVote', { targetId: 'alice' });
    assert.equal((await result).eliminated, null, 'one vote each');
  } finally {
    server.close();
  }
});

test('the alert is paused during the report and resumes with the time it had left', async () => {
  const server = await startServer({ alertCountdownMs: 5000, reportMs: 30, voteMs: 30, tallyMs: 30, resultMs: 30 });
  try {
    const [alice] = await startedGame(server);
    const on = waitForEvent(alice, 'alert');
    alice.emit('alertStart');
    await on;

    const paused = waitForEvent(alice, 'alert');
    alice.emit('reportBody');
    assert.equal((await paused).active, false);

    const resumed = waitForEvent(alice, 'alert');
    await waitForPhase(alice, null);
    const alert = await resumed;
    assert.equal(alert.active, true);
    assert.ok(alert.remainingMs < 5000 && alert.remainingMs > 4000);
  } finally {
    server.close();
  }
});
