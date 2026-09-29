import test from 'node:test';
import assert from 'node:assert/strict';
import { saveCharacter, getCharacter, photoUrl, photoData, clearCharacters } from './characterStore.js';

const photo = (text) => `data:image/jpeg;base64,${Buffer.from(text).toString('base64')}`;

test('a character is kept per phone, with its photo at an address that changes only with the photo', () => {
  clearCharacters();
  saveCharacter('alice', { name: 'Alice', photo: photo('one'), color: '#c51111', hat: 'none' });
  assert.equal(getCharacter('alice').name, 'Alice');
  const first = photoUrl('alice');
  assert.match(first, /^\/photos\/alice\?v=\d+$/);
  assert.equal(photoData('alice').toString(), 'one');

  saveCharacter('alice', { name: 'Alice', photo: photo('one'), color: '#132ed1', hat: 'crown' });
  assert.equal(photoUrl('alice'), first, 'same photo, same address (stays cached)');

  saveCharacter('alice', { name: 'Alice', photo: photo('two'), color: '#132ed1', hat: 'crown' });
  assert.notEqual(photoUrl('alice'), first, 'new photo, new address');
  assert.equal(photoData('alice').toString(), 'two');
});

test('no photo, no address', () => {
  clearCharacters();
  saveCharacter('bob', { name: 'Bob', photo: null, color: '#c51111', hat: 'none' });
  assert.equal(photoUrl('bob'), null);
  assert.equal(photoData('bob'), null);
  assert.equal(photoUrl('nobody'), null);
});
