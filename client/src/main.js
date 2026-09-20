import { Html5Qrcode } from 'html5-qrcode';
import { texts } from './texts.fr.js';
import { sounds, preloadAssets } from './assets.js';
import './style.css';

preloadAssets();

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="home">
    <div id="home-screen" class="home-buttons">
      <div class="title-panel">
        <h1 class="home-title">${texts.homeTitle}</h1>
      </div>

      <button id="test-button" class="test-button">${texts.testButton}</button>

      <button id="scan-button" class="test-button">${texts.scanButton}</button>

      <button id="test-minigame1-button" class="test-button">${texts.testMinigame1Button}</button>
    </div>

    <div id="minigame-screen" class="minigame hidden">
      <div class="minigame-instruction">
        <p class="minigame-instruction-label">${texts.miniGameInstruction}</p>
        <p class="minigame-code" id="minigame-code"></p>
      </div>
      <div class="keypad" id="keypad"></div>
    </div>

    <div id="colorgame-screen" class="colorgame hidden">
      <div class="colorgame-instruction">
        <p class="minigame-instruction-label">${texts.colorGameInstruction}</p>
      </div>
      <div class="colorgame-board" id="colorgame-board"></div>
      <div class="colorgame-counter" id="colorgame-counter">
        <div class="counter-dot"></div>
        <div class="counter-dot"></div>
        <div class="counter-dot"></div>
      </div>
    </div>

    <div class="minigame-popup hidden" id="minigame-popup">
      <p id="minigame-popup-text" class="hud-panel"></p>
    </div>

    <div class="scan-popup hidden" id="scan-popup">
      <div class="scan-popup-content">
        <button id="scan-close-button" class="scan-close-button" aria-label="${texts.closeButtonLabel}">×</button>
        <div class="qr-reader-frame">
          <div id="qr-reader" class="qr-reader"></div>
          <div class="scan-reticle"></div>
          <div class="rec-dot"></div>
        </div>
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
const keypad = document.querySelector('#keypad');
const minigamePopup = document.querySelector('#minigame-popup');
const minigamePopupText = document.querySelector('#minigame-popup-text');

const CODE_LENGTH = 4;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const ERROR_POPUP_DURATION_MS = 1000;
const SUCCESS_SOUND_DELAY_MS = 500;

let code = [];
let position = 0;
let inputLocked = false;

function playDigitTone(digit) {
  // Same beep sample, pitched up one semitone per digit (0 = recorded
  // pitch, 9 = nine semitones higher) so each number has its own tone.
  const tone = sounds.beep.cloneNode();
  tone.preservesPitch = false;
  tone.mozPreservesPitch = false;
  tone.webkitPreservesPitch = false;
  tone.playbackRate = 2 ** (digit / 12);
  tone.play().catch(() => {}); // sound is non-essential, ignore playback errors
}

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
  minigameCode.textContent = code.join(' ');
  renderKeypad();
}

let activeGameClose = closeMiniGame;

function openMiniGame() {
  homeScreen.classList.add('hidden');
  minigameScreen.classList.remove('hidden');
  pushOverlayState();
  activeGameClose = closeMiniGame;
  newRound();
}

function closeMiniGame() {
  hidePopup();
  minigameScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  closeOverlayState();
}

function showPopup(type, text) {
  minigamePopupText.textContent = text;
  minigamePopupText.classList.remove('hud-error', 'hud-success');
  minigamePopupText.classList.add(`hud-${type}`);
  minigamePopup.classList.remove('hidden');
}

function hidePopup() {
  minigamePopup.classList.add('hidden');
}

function playSuccessSoundThenClose() {
  const sound = sounds.success;
  const finish = () => {
    sound.removeEventListener('ended', finish);
    activeGameClose();
  };
  sound.currentTime = 0;
  sound.addEventListener('ended', finish, { once: true });
  sound.play().catch(finish); // if playback is blocked, don't get stuck on this screen
}

function handleDigitTap(digit) {
  if (inputLocked) return;

  if (digit === code[position]) {
    playDigitTone(digit);
    position += 1;
    if (position === code.length) {
      inputLocked = true;
      setTimeout(() => {
        showPopup('success', texts.miniGameSuccess);
        playSuccessSoundThenClose();
      }, SUCCESS_SOUND_DELAY_MS);
    }
  } else {
    inputLocked = true;
    showPopup('error', texts.miniGameFail);
    sounds.error.currentTime = 0;
    sounds.error.play().catch(() => {}); // browser may block autoplay in edge cases; sound is non-essential
    setTimeout(() => {
      hidePopup();
      newRound();
    }, ERROR_POPUP_DURATION_MS);
  }
}

testButton.addEventListener('click', openMiniGame);

const testMinigame1Button = document.querySelector('#test-minigame1-button');
const colorGameScreen = document.querySelector('#colorgame-screen');
const colorGameBoard = document.querySelector('#colorgame-board');
const counterDots = document.querySelectorAll('#colorgame-counter .counter-dot');

const COLOR_PALETTE = ['#ff4d4d', '#4da6ff', '#ffd24d', '#4dff88', '#ff66cc', '#b366ff', '#ff9933', '#33ffee'];
const SHAPE_COUNT = 4;
const SQUARE_SIZE = 50;
const CIRCLE_SIZE = 60;
const MATCH_THRESHOLD = 40;
const TOTAL_ROUNDS = 3;
const ROUND_RESET_DELAY_MS = 500;

let matchedCount = 0;
let roundsCompleted = 0;

function resetCounter() {
  roundsCompleted = 0;
  counterDots.forEach((dot) => dot.classList.remove('filled'));
}

function markRoundComplete() {
  counterDots[roundsCompleted].classList.add('filled');
  roundsCompleted += 1;
}

function randomPosition(boardRect, size) {
  return {
    x: Math.random() * Math.max(boardRect.width - size, 0),
    y: Math.random() * Math.max(boardRect.height - size, 0),
  };
}

function createShape(className, size, color, boardRect) {
  const shape = document.createElement('div');
  shape.className = className;
  shape.dataset.color = color;
  const pos = randomPosition(boardRect, size);
  shape.style.left = `${pos.x}px`;
  shape.style.top = `${pos.y}px`;
  return shape;
}

function makeDraggable(square) {
  let offsetX = 0;
  let offsetY = 0;

  function onPointerMove(event) {
    const boardRect = colorGameBoard.getBoundingClientRect();
    const x = Math.max(0, Math.min(event.clientX - boardRect.left - offsetX, boardRect.width - SQUARE_SIZE));
    const y = Math.max(0, Math.min(event.clientY - boardRect.top - offsetY, boardRect.height - SQUARE_SIZE));
    square.style.left = `${x}px`;
    square.style.top = `${y}px`;
  }

  function onPointerUp(event) {
    square.releasePointerCapture(event.pointerId);
    square.classList.remove('dragging');
    square.removeEventListener('pointermove', onPointerMove);
    square.removeEventListener('pointerup', onPointerUp);
    square.removeEventListener('pointercancel', onPointerUp);
    checkMatch(square);
  }

  square.addEventListener('pointerdown', (event) => {
    if (square.classList.contains('matched')) return;
    square.setPointerCapture(event.pointerId);
    const boardRect = colorGameBoard.getBoundingClientRect();
    offsetX = event.clientX - boardRect.left - square.offsetLeft;
    offsetY = event.clientY - boardRect.top - square.offsetTop;
    square.classList.add('dragging');
    square.addEventListener('pointermove', onPointerMove);
    square.addEventListener('pointerup', onPointerUp);
    square.addEventListener('pointercancel', onPointerUp);
  });
}

function checkMatch(square) {
  const circle = colorGameBoard.querySelector(`.color-circle[data-color="${square.dataset.color}"]`);
  const squareCenter = { x: square.offsetLeft + SQUARE_SIZE / 2, y: square.offsetTop + SQUARE_SIZE / 2 };
  const circleCenter = { x: circle.offsetLeft + CIRCLE_SIZE / 2, y: circle.offsetTop + CIRCLE_SIZE / 2 };
  const distance = Math.hypot(squareCenter.x - circleCenter.x, squareCenter.y - circleCenter.y);

  if (distance >= MATCH_THRESHOLD) return;

  square.style.left = `${circle.offsetLeft + (CIRCLE_SIZE - SQUARE_SIZE) / 2}px`;
  square.style.top = `${circle.offsetTop + (CIRCLE_SIZE - SQUARE_SIZE) / 2}px`;
  square.classList.add('matched');
  matchedCount += 1;

  if (matchedCount !== SHAPE_COUNT) return;

  markRoundComplete();
  if (roundsCompleted < TOTAL_ROUNDS) {
    setTimeout(newColorRound, ROUND_RESET_DELAY_MS);
  } else {
    setTimeout(() => {
      // TODO: swap sounds.success for a dedicated general-task sound once provided.
      showPopup('success', texts.taskSuccess);
      playSuccessSoundThenClose();
    }, SUCCESS_SOUND_DELAY_MS);
  }
}

function newColorRound() {
  matchedCount = 0;
  colorGameBoard.innerHTML = '';
  const boardRect = colorGameBoard.getBoundingClientRect();
  const colors = shuffled(COLOR_PALETTE).slice(0, SHAPE_COUNT);

  colors.forEach((color) => {
    const circle = createShape('color-circle', CIRCLE_SIZE, color, boardRect);
    circle.style.borderColor = color;
    colorGameBoard.appendChild(circle);
  });

  colors.forEach((color) => {
    const square = createShape('color-square', SQUARE_SIZE, color, boardRect);
    square.style.background = color;
    makeDraggable(square);
    colorGameBoard.appendChild(square);
  });
}

function openColorGame() {
  homeScreen.classList.add('hidden');
  colorGameScreen.classList.remove('hidden');
  pushOverlayState();
  activeGameClose = closeColorGame;
  resetCounter();
  newColorRound();
}

function closeColorGame() {
  hidePopup();
  colorGameScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  closeOverlayState();
}

testMinigame1Button.addEventListener('click', openColorGame);

const scanButton = document.querySelector('#scan-button');
const scanPopup = document.querySelector('#scan-popup');
const scanCloseButton = document.querySelector('#scan-close-button');
const scanAgainButton = document.querySelector('#scan-again-button');
const qrReaderFrame = document.querySelector('.qr-reader-frame');
const scanResult = document.querySelector('#scan-result');

const html5QrCode = new Html5Qrcode('qr-reader');
let isScanning = false;

function stopScan() {
  isScanning = false;
  qrReaderFrame.classList.add('hidden');
}

function startScan() {
  isScanning = true;
  scanAgainButton.classList.add('hidden');
  scanResult.classList.add('hidden');
  qrReaderFrame.classList.remove('hidden');

  html5QrCode
    .start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250, aspectRatio: 1.0 },
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
  pushOverlayState();
  startScan();
}

function closeScanPopup() {
  scanPopup.classList.add('hidden');
  if (isScanning) {
    html5QrCode.stop().catch(() => {}); // may already be released by the OS
  }
  stopScan();
  closeOverlayState();
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

// Makes the phone's back button return to the home screen instead of
// leaving the site. Opening a screen pushes one history entry; closing
// it (by any means) consumes that entry too, so back never needs more
// than one press and history never accumulates stale entries.
let closingFromPopState = false;

function pushOverlayState() {
  history.pushState({ overlay: true }, '', '');
}

function closeOverlayState() {
  if (!closingFromPopState) {
    history.back();
  }
}

window.addEventListener('popstate', () => {
  closingFromPopState = true;
  if (!minigameScreen.classList.contains('hidden')) {
    closeMiniGame();
  } else if (!scanPopup.classList.contains('hidden')) {
    closeScanPopup();
  } else if (!colorGameScreen.classList.contains('hidden')) {
    closeColorGame();
  }
  closingFromPopState = false;
});
