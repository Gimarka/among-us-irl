import { Html5Qrcode } from 'html5-qrcode';
import { texts } from './texts.fr.js';
import { sounds, preloadAssets } from './assets.js';
import './style.css';

preloadAssets();

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="home">
    <div id="home-screen">
      <h1 class="home-title">${texts.homeTitle}</h1>

      <button id="test-button" class="test-button">${texts.testButton}</button>

      <button id="scan-button" class="test-button">${texts.scanButton}</button>
    </div>

    <div id="minigame-screen" class="minigame hidden">
      <p class="minigame-instruction">${texts.miniGameInstruction}</p>
      <p class="minigame-code" id="minigame-code"></p>
      <div class="keypad" id="keypad"></div>
      <p class="minigame-message hidden success" id="minigame-message"></p>
    </div>

    <div class="minigame-popup hidden" id="minigame-popup">
      <p id="minigame-popup-text"></p>
    </div>

    <div class="scan-popup hidden" id="scan-popup">
      <div class="scan-popup-content">
        <button id="scan-close-button" class="scan-close-button" aria-label="${texts.closeButtonLabel}">×</button>
        <div id="qr-reader" class="qr-reader"></div>
        <p class="test-result hidden" id="scan-result"></p>
        <button id="scan-again-button" class="test-button hidden">${texts.scanAgainButton}</button>
      </div>
    </div>
  </div>
`;

const homeScreen = document.querySelector('#home-screen');
const testButton = document.querySelector('#test-button');

const minigameScreen = document.querySelector('#minigame-screen');
const minigameCode = document.querySelector('#minigame-code');
const minigameMessage = document.querySelector('#minigame-message');
const keypad = document.querySelector('#keypad');
const minigamePopup = document.querySelector('#minigame-popup');
const minigamePopupText = document.querySelector('#minigame-popup-text');

const CODE_LENGTH = 4;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ERROR_POPUP_DURATION_MS = 1000;

let code = [];
let position = 0;
let inputLocked = false;

function shuffled(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function createKeypadButton(digit) {
  const button = document.createElement('button');
  button.className = 'keypad-button';
  button.textContent = String(digit);
  button.addEventListener('click', () => handleDigitTap(digit));
  return button;
}

function renderKeypad() {
  keypad.innerHTML = '';
  shuffled(DIGITS).forEach((digit) => keypad.appendChild(createKeypadButton(digit)));
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
  renderKeypad();
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

function showErrorPopup() {
  minigamePopupText.textContent = texts.miniGameFail;
  minigamePopup.classList.remove('hidden');
  sounds.error.currentTime = 0;
  sounds.error.play().catch(() => {}); // browser may block autoplay in edge cases; sound is non-essential
}

function hideErrorPopup() {
  minigamePopup.classList.add('hidden');
}

function handleDigitTap(digit) {
  if (inputLocked) return;

  if (digit === code[position]) {
    position += 1;
    if (position === code.length) {
      inputLocked = true;
      minigameMessage.textContent = texts.miniGameSuccess;
      minigameMessage.classList.remove('hidden');
      setTimeout(closeMiniGame, 700);
    }
  } else {
    inputLocked = true;
    showErrorPopup();
    setTimeout(() => {
      hideErrorPopup();
      newRound();
    }, ERROR_POPUP_DURATION_MS);
  }
}

testButton.addEventListener('click', openMiniGame);

const scanButton = document.querySelector('#scan-button');
const scanPopup = document.querySelector('#scan-popup');
const scanCloseButton = document.querySelector('#scan-close-button');
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
    });
}

function openScanPopup() {
  scanPopup.classList.remove('hidden');
  startScan();
}

function closeScanPopup() {
  scanPopup.classList.add('hidden');
  if (isScanning) {
    html5QrCode.stop().catch(() => {}); // may already be released by the OS
  }
  stopScan();
}

scanButton.addEventListener('click', openScanPopup);
scanCloseButton.addEventListener('click', closeScanPopup);
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
