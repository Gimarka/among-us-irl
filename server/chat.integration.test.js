// The chat: real HTTP server, real sockets. The state only says which
// message is the latest; phones fetch the ones they don't have.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer, act, until, joinGame, startedGame } from './testSupport.js';

const getChat = (phone, afterId) => phone.emitWithAck('getChat', { afterId });

test('a chat message reaches every phone with the sender\'s name, colour, hat and photo address', async () => {
  const server = await startServer();
  try {
    const { phones: [alice, bob] } = await startedGame(server, ['Alice', 'Bob']);
    await act(alice, 'chat', { text: '  salut  ' });
    await until(bob, (s) => s.chatLastId === 1);

    const [message] = await getChat(bob, 0);
    const alicePlayer = bob.state.players.find((p) => p.id === 'alice');
    assert.equal(message.text, 'salut');
    assert.deepEqual([message.name, message.color, message.hat], ['Alice', alicePlayer.color, alicePlayer.hat]);
    assert.ok('photo' in message);
    assert.deepEqual(await getChat(bob, 1), [], 'nothing after the latest');
  } finally {
    server.close();
  }
});

test('a phone joining (or coming back) can fetch the game\'s whole chat', async () => {
  const server = await startServer();
  try {
    const { phones: [alice], gameId } = await startedGame(server, ['Alice']);
    await act(alice, 'chat', { text: 'un' });
    await act(alice, 'chat', { text: 'deux' });

    const bob = await server.connect();
    const { state } = await joinGame(bob, gameId, { clientId: 'bob', name: 'Bob' });
    assert.equal(state.chatLastId, 2);
    assert.deepEqual((await getChat(bob, 0)).map((m) => m.text), ['un', 'deux']);
  } finally {
    server.close();
  }
});

test('blank or whitespace-only chat messages are dropped', async () => {
  const server = await startServer();
  try {
    const { phones: [alice] } = await startedGame(server, ['Alice']);
    assert.equal((await act(alice, 'chat', { text: '   ' })).ok, false);
    assert.equal((await act(alice, 'chat', {})).ok, false);
    assert.equal(alice.state.chatLastId, 0);
  } finally {
    server.close();
  }
});
