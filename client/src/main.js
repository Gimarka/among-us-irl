import { Html5Qrcode } from 'html5-qrcode';
import { texts } from './texts.fr.js';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="home">
    <div id="home-screen">
      <h1 class="home-title">${texts.homeTitle}</h1>

      <button id="test-button" class="test-button">${texts.testButton}</button>

      <button id="scan-button" class="test-button">${texts.scanButton}</button>
      <div id="qr-reader" class="qr-reader hidden"></div>
      <p class="test-result hidden" id="scan-result"></p>
      <button id="scan-again-button" class="test-button hidden">${texts.scanAgainButton}</button>
    </div>

    <div id="minigame-screen" class="minigame hidden">
      <p class="minigame-instruction">${texts.miniGameInstruction}</p>
      <p class="minigame-code" id="minigame-code"></p>
      <div class="keypad" id="keypad"></div>
      <p class="minigame-message hidden" id="minigame-message"></p>
    </div>
  </div>
`;

const homeScreen = document.querySelector('#home-screen');
const testButton = document.querySelector('#test-button');

const minigameScreen = document.querySelector('#minigame-screen');
const minigameCode = document.querySelector('#minigame-code');
const minigameMessage = document.querySelector('#minigame-message');
const keypad = document.querySelector('#keypad');

const CODE_LENGTH = 4;
let code = [];
let position = 0;
let inputLocked = false;

for (let digit = 1; digit <= 9; digit += 1) {
  keypad.appendChild(createKeypadButton(digit));
}
keypad.appendChild(createKeypadButton(0));

function createKeypadButton(digit) {
  const button = document.createElement('button');
  button.className = 'keypad-button';
  button.textContent = String(digit);
  button.addEventListener('click', () => handleDigitTap(digit));
  return button;
}

function randomCode(length) {
  return Array.from({ length }, () => Math.floor(Math.random() * 10));
}

function newRound() {
  code = randomCode(CODE_LENGTH);
  position = 0;
  inputLocked = false;
  minigameMessage.classList.add('hidden');
  minigameCode.textContent = code.join(' ');
}

function openMiniGame() {
  homeScreen.classList.add('hidden');
  minigameScreen.classList.remove('hidden');
  newRound();
}

function closeMiniGame() {
  minigameScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
}

function handleDigitTap(digit) {
  if (inputLocked) return;

  if (digit === code[position]) {
    position += 1;
    if (position === code.length) {
      inputLocked = true;
      minigameMessage.textContent = texts.miniGameSuccess;
      minigameMessage.classList.remove('hidden', 'error');
      minigameMessage.classList.add('success');
      setTimeout(closeMiniGame, 700);
    }
  } else {
    inputLocked = true;
    minigameMessage.textContent = texts.miniGameFail;
    minigameMessage.classList.remove('hidden', 'success');
    minigameMessage.classList.add('error');
    setTimeout(newRound, 900);
  }
}

testButton.addEventListener('click', openMiniGame);

const scanButton = document.querySelector('#scan-button');
const scanAgainButton = document.querySelector('#scan-again-button');
const qrReader = document.querySelector('#qr-reader');
const scanResult = document.querySelector('#scan-result');

const html5QrCode = new Html5Qrcode('qr-reader');
let isScanning = false;

function stopScan() {
  isScanning = false;
  qrReader.classList.add('hidden');
}

function startScan() {
  isScanning = true;
  scanButton.classList.add('hidden');
  scanAgainButton.classList.add('hidden');
  scanResult.classList.add('hidden');
  qrReader.classList.remove('hidden');

  html5QrCode
    .start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        stopScan();
        html5QrCode.stop().then(() => {
          scanResult.textContent = `${texts.scanResultLabel} ${decodedText}`;
          scanResult.classList.remove('hidden');
          scanAgainButton.classList.remove('hidden');
        });
      },
      () => {} // fires every frame with no QR in view; nothing to do
    )
    .catch(() => {
      stopScan();
      scanResult.textContent = texts.cameraError;
      scanResult.classList.remove('hidden');
      scanButton.classList.remove('hidden');
    });
}

scanButton.addEventListener('click', startScan);
scanAgainButton.addEventListener('click', startScan);

// The phone's OS suspends the camera when the screen locks or the tab
// is backgrounded; the video feed stays frozen on the last frame when
// the page comes back unless we restart the camera stream ourselves.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && isScanning) {
    html5QrCode
      .stop()
      .catch(() => {}) // the browser may have already released the camera
      .then(startScan);
  }
});
