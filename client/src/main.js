import { io } from 'socket.io-client';
import { texts } from './texts.fr.js';
import './style.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const app = document.querySelector('#app');
app.innerHTML = `
  <h1>${texts.title}</h1>
  <p class="status" id="status">${texts.connecting}</p>

  <div id="join-form">
    <label for="name-input">${texts.namePrompt}</label>
    <input id="name-input" type="text" placeholder="${texts.namePlaceholder}" maxlength="20" />
    <button id="join-button">${texts.joinButton}</button>
  </div>

  <div class="players hidden" id="players-section">
    <h2>${texts.playersHeading}</h2>
    <ul id="players-list"></ul>
  </div>
`;

const statusEl = document.querySelector('#status');
const joinForm = document.querySelector('#join-form');
const nameInput = document.querySelector('#name-input');
const joinButton = document.querySelector('#join-button');
const playersSection = document.querySelector('#players-section');
const playersList = document.querySelector('#players-list');

const socket = io(SERVER_URL);

socket.on('connect', () => {
  statusEl.textContent = '';
});

socket.on('disconnect', () => {
  statusEl.textContent = texts.disconnected;
});

socket.on('players', (players) => {
  playersSection.classList.remove('hidden');
  playersList.innerHTML = players.length
    ? players.map((p) => `<li>${escapeHtml(p.name)}</li>`).join('')
    : `<li>${texts.noPlayers}</li>`;
});

joinButton.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) return;
  socket.emit('join', name);
  joinForm.classList.add('hidden');
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
