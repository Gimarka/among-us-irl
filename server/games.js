// Every running game, side by side and fully separate, each created by a
// player choosing NOUVELLE PARTIE and known by its name. A game is deleted
// as soon as its roster is empty (see index.js).

import { createGame } from './game.js';

export const MAX_GAME_NAME_LENGTH = 20;

const games = new Map(); // id -> game
let lastGameId = 0;

// clientId -> id of the game that phone last joined, so a phone opening the
// app again can be taken straight back to it (see getClientGame).
const lastGameOfClient = new Map();

export function cleanGameName(name) {
  if (typeof name !== 'string') return '';
  return name.trim().slice(0, MAX_GAME_NAME_LENGTH);
}

// Names are unique among running games, ignoring upper/lower case, so the
// REJOINDRE list never shows two games you can't tell apart.
export function isGameNameTaken(name) {
  const wanted = name.toLowerCase();
  return Array.from(games.values()).some((game) => game.name.toLowerCase() === wanted);
}

// deps: what createGame needs besides its name and host (timings,
// characters, onChange - onChange gets the game that changed).
export function addGame(name, hostId, { onChange = () => {}, ...deps } = {}) {
  lastGameId += 1;
  let game = null;
  game = createGame({ id: lastGameId, name, hostId, ...deps, onChange: () => onChange(game) });
  games.set(game.id, game);
  return game;
}

export function getGame(id) {
  return games.get(id) || null;
}

// Stops the game's timers too, so nothing fires for a game that's gone.
export function deleteGame(id) {
  games.get(id)?.dispose();
  games.delete(id);
}

// What the REJOINDRE popup shows - nothing about who's in which game.
export function listGames() {
  return Array.from(games.values(), (game) => game.summary());
}

export function clearGames() {
  Array.from(games.keys()).forEach(deleteGame);
  lastGameOfClient.clear();
}

export function rememberClientGame(clientId, gameId) {
  lastGameOfClient.set(clientId, gameId);
}

// The game a phone should be taken back to, if any: the last one it joined,
// provided that game still exists and the phone is still part of it (in its
// lobby, or playing it - even after leaving on purpose, since its role is
// kept). A phone that left a lobby before the game started isn't.
export function getClientGame(clientId) {
  const game = games.get(lastGameOfClient.get(clientId));
  if (!game) return null;
  return game.has(clientId) || game.isMember(clientId) ? game : null;
}
