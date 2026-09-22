import { io } from 'socket.io-client';
import { Html5Qrcode } from 'html5-qrcode';
import { texts } from './texts.fr.js';
import { sounds, preloadAssets } from './assets.js';
import { initBackground } from './background.js';
import {
  characterMarkup,
  setVisorPhoto,
  clearVisorPhoto,
  setSuitColor,
  setHat,
  SUIT_COLORS,
  DEFAULT_SUIT_COLOR,
  DEFAULT_HAT,
  HATS,
} from './character.js';
import './style.css';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

preloadAssets();
initBackground();

// The waiting room between joining and the menu: one slot per possible
// player, filled in as people join (see renderLobby below).
const LOBBY_SLOT_COUNT = 10;

function lobbySlotMarkup(index) {
  return `
    <div class="lobby-slot" id="lobby-slot-${index}">
      <div class="character-frame character-frame-tiny" id="lobby-${index}-character">
        ${characterMarkup(`lobby-${index}`)}
      </div>
      <p class="lobby-slot-name" id="lobby-slot-${index}-name">${texts.emptySlot}</p>
    </div>
  `;
}

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="home">
    <div class="title-panel">
      <h1 class="home-title">${texts.homeTitle}</h1>
    </div>

    <div id="join-screen" class="screen">
      <div class="screen-fit home-buttons">
        <div class="character-frame character-frame-large" id="join-character">
          <video id="selfie-video" class="character-video hidden" playsinline muted></video>
          ${characterMarkup('join')}
          <div class="hat-arrows">
            <button id="hat-prev" class="hat-arrow" aria-label="${texts.previousHat}">▲</button>
            <button id="hat-next" class="hat-arrow" aria-label="${texts.nextHat}">▼</button>
          </div>
        </div>

        <div class="color-picker" id="color-picker"></div>

        <button id="selfie-button" class="test-button">${texts.takeSelfieButton}</button>

        <input id="join-name-input" class="name-input" type="text" placeholder="${texts.namePrompt}" maxlength="20" />
        <button id="join-button" class="test-button">${texts.joinButton}</button>
      </div>
    </div>

    <div id="lobby-screen" class="screen hidden">
      <div class="screen-fit lobby">
        <div class="lobby-instruction">
          <p class="minigame-instruction-label">${texts.playersHeading}</p>
        </div>

        <div class="lobby-grid">
          ${Array.from({ length: LOBBY_SLOT_COUNT }, (_, index) => lobbySlotMarkup(index)).join('')}
        </div>

        <button id="play-button" class="test-button">${texts.playButton}</button>
      </div>
    </div>

    <div id="home-screen" class="screen hidden">
      <div class="screen-fit home-buttons">
        <div class="character-frame" id="menu-character">
          ${characterMarkup('menu')}
        </div>

        <button id="test-button" class="test-button">${texts.testButton}</button>

        <button id="scan-button" class="test-button">${texts.scanButton}</button>

        <button id="test-minigame1-button" class="test-button">${texts.testMinigame1Button}</button>
      </div>
    </div>

    <div id="minigame-screen" class="screen hidden">
      <div class="screen-fit minigame">
        <div class="minigame-instruction">
          <p class="minigame-instruction-label">${texts.miniGameInstruction}</p>
          <p class="minigame-code" id="minigame-code"></p>
        </div>
        <div class="keypad" id="keypad"></div>
      </div>
    </div>

    <div id="colorgame-screen" class="screen colorgame hidden">
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

// The title sits in a fixed panel, outside the flow, so the screens below it
// don't know how tall it is and tall content (a hat, for instance) slides
// underneath. Measure it and reserve exactly that much room at the top.
const titlePanel = document.querySelector('.title-panel');
const homeLayout = document.querySelector('.home');
const TITLE_GAP_PX = 12;
const SCREEN_BOTTOM_GAP_PX = 16;

// Screens that get shrunk to fit rather than sized with vh units, because
// their content is a flat stack (character, buttons, a keypad) with no
// pixel math that a scale transform could throw off. The colorgame screen
// is deliberately left out: its drag-and-drop reads real, untransformed
// pointer positions, so it's sized with vh-relative CSS instead (see
// .colorgame-board in style.css).
const FIT_SCREEN_SELECTOR = '#join-screen, #lobby-screen, #home-screen, #minigame-screen';

function syncTitleSpace() {
  const titleBottom = titlePanel.getBoundingClientRect().bottom;
  const space = titleBottom + TITLE_GAP_PX;
  homeLayout.style.setProperty('--title-space', `${Math.round(space)}px`);
  const availableHeight = window.innerHeight - space - SCREEN_BOTTOM_GAP_PX;
  homeLayout.style.setProperty('--avail-h', `${Math.round(availableHeight)}px`);
}

// Everything must fit on screen with no scrolling, on any phone. Rather than
// hand-tune sizes for every viewport, measure each screen's natural
// (unscaled) size against the space actually available below the title and
// shrink it uniformly if it doesn't fit. Because the screen itself is the
// box that centres its content (see .screen in style.css), scaling it from
// its own centre keeps that content centred as it shrinks.
// scrollHeight/scrollWidth only measure overflow that spills past an
// element's own bottom/right edge - a flex box that centres oversized
// content (as ours does) overflows equally on the top/left too, and that
// half is invisible to scrollHeight. So the true extent is measured by
// hand: the outermost edges of everything actually rendered inside, which
// also naturally picks up an absolutely positioned child (the hat arrows)
// poking out past its own parent's box.
function measureContentExtent(container) {
  let minTop = Infinity;
  let maxBottom = -Infinity;
  let minLeft = Infinity;
  let maxRight = -Infinity;
  container.querySelectorAll('*').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return; // hidden/collapsed, ignore
    minTop = Math.min(minTop, rect.top);
    maxBottom = Math.max(maxBottom, rect.bottom);
    minLeft = Math.min(minLeft, rect.left);
    maxRight = Math.max(maxRight, rect.right);
  });
  if (!Number.isFinite(minTop)) return { height: 0, width: 0 };
  return { height: maxBottom - minTop, width: maxRight - minLeft };
}

function fitActiveScreen() {
  document.querySelectorAll(FIT_SCREEN_SELECTOR).forEach((screen) => {
    if (screen.classList.contains('hidden')) return;
    // Scaling the screen itself would shrink its own box along with its
    // content - a moving target, since the "available space" would keep
    // shrinking along with whatever we're trying to fit into it. Instead the
    // screen is a fixed, unscaled viewport (see .screen in style.css) and
    // only its inner .screen-fit wrapper - the actual content - gets scaled.
    const content = screen.querySelector(':scope > .screen-fit');
    content.style.transform = 'none';
    const availableHeight = screen.clientHeight;
    const availableWidth = screen.clientWidth;
    const { height: naturalHeight, width: naturalWidth } = measureContentExtent(content);
    const scale = Math.min(1, availableHeight / naturalHeight, availableWidth / naturalWidth);
    content.style.transform = scale < 1 ? `scale(${scale})` : 'none';
  });
}

function syncLayout() {
  syncTitleSpace();
  fitActiveScreen();
}

syncLayout();
window.addEventListener('resize', syncLayout);
window.addEventListener('orientationchange', syncLayout);
// The panel's height comes from its font, so re-measure once Orbitron lands.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(syncLayout);
}

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
  // Fill the keypad before fitting: the fit measures actual rendered content,
  // and an empty keypad would under-measure how tall this screen really is.
  newRound();
  fitActiveScreen();
}

function closeMiniGame() {
  hidePopup();
  minigameScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  fitActiveScreen();
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
const SHAPE_GAP = 8;
const MAX_PLACEMENT_ATTEMPTS = 200;

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

function centerOf(pos, size) {
  return { cx: pos.x + size / 2, cy: pos.y + size / 2 };
}

function overlapsPlaced(center, radius, placed) {
  return placed.some((p) => Math.hypot(center.cx - p.cx, center.cy - p.cy) < radius + p.r + SHAPE_GAP);
}

function randomNonOverlappingPosition(boardRect, size, placed) {
  const radius = size / 2;
  for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
    const pos = randomPosition(boardRect, size);
    if (!overlapsPlaced(centerOf(pos, size), radius, placed)) return pos;
  }
  return randomPosition(boardRect, size); // board too cramped to fit everyone with a gap; place anyway
}

function createShape(className, size, color, boardRect, placed) {
  const shape = document.createElement('div');
  shape.className = className;
  shape.dataset.color = color;
  const pos = randomNonOverlappingPosition(boardRect, size, placed);
  placed.push({ ...centerOf(pos, size), r: size / 2 });
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
  const placed = [];

  colors.forEach((color) => {
    const circle = createShape('color-circle', CIRCLE_SIZE, color, boardRect, placed);
    circle.style.borderColor = color;
    colorGameBoard.appendChild(circle);
  });

  colors.forEach((color) => {
    const square = createShape('color-square', SQUARE_SIZE, color, boardRect, placed);
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
  fitActiveScreen();
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

const joinScreen = document.querySelector('#join-screen');
const joinNameInput = document.querySelector('#join-name-input');
const joinButton = document.querySelector('#join-button');
const selfieButton = document.querySelector('#selfie-button');
const selfieVideo = document.querySelector('#selfie-video');
const joinCharacter = document.querySelector('#join-character');
const menuCharacter = document.querySelector('#menu-character');
const colorPicker = document.querySelector('#color-picker');

const lobbyScreen = document.querySelector('#lobby-screen');
const playButton = document.querySelector('#play-button');
const lobbySlots = Array.from({ length: LOBBY_SLOT_COUNT }, (_, index) => ({
  root: document.querySelector(`#lobby-slot-${index}`),
  frame: document.querySelector(`#lobby-${index}-character`),
  nameEl: document.querySelector(`#lobby-slot-${index}-name`),
  id: `lobby-${index}`,
  hasPhoto: false,
}));

// Renders the current player list into the fixed lobby slots. Slots are
// filled in server order (the order players joined in) and any slot past
// the last player is shown empty; a slot that previously held a photo but
// is reused for a photo-less player is reset back to the plain visor.
function renderLobby(players) {
  lobbySlots.forEach((slot, index) => {
    const player = players[index];
    if (!player) {
      slot.root.classList.add('lobby-slot-empty');
      slot.nameEl.textContent = texts.emptySlot;
      setSuitColor(slot.frame, DEFAULT_SUIT_COLOR);
      setHat(slot.frame, DEFAULT_HAT);
      if (slot.hasPhoto) {
        clearVisorPhoto(slot.id);
        slot.hasPhoto = false;
      }
      return;
    }

    slot.root.classList.remove('lobby-slot-empty');
    slot.nameEl.textContent = player.name;
    setSuitColor(slot.frame, player.color || DEFAULT_SUIT_COLOR);
    setHat(slot.frame, player.hat || DEFAULT_HAT);
    if (player.photo) {
      setVisorPhoto(slot.id, player.photo);
      slot.hasPhoto = true;
    } else if (slot.hasPhoto) {
      clearVisorPhoto(slot.id);
      slot.hasPhoto = false;
    }
  });

  if (!lobbyScreen.classList.contains('hidden')) {
    fitActiveScreen();
  }
}

function openLobby() {
  joinScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  fitActiveScreen();
}

function openMenuFromLobby() {
  lobbyScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  fitActiveScreen();
}

playButton.addEventListener('click', openMenuFromLobby);

// A face shown at avatar size never needs more than this, and it keeps the
// photo at a few KB so it's cheap to send and to hold in server memory.
// The shape matches the visor's image box so the saved photo frames the face
// exactly like the live preview did.
const PHOTO_WIDTH = 144;
const PHOTO_HEIGHT = 200;
const PHOTO_ASPECT = PHOTO_WIDTH / PHOTO_HEIGHT;
const PHOTO_QUALITY = 0.6;

let socket = null;
let selfieStream = null;
let photoDataUrl = null;
let suitColor = DEFAULT_SUIT_COLOR;

function selectColor(color, swatch) {
  suitColor = color;
  setSuitColor(joinCharacter, color);
  colorPicker.querySelectorAll('.color-swatch').forEach((other) => {
    other.classList.toggle('selected', other === swatch);
  });
}

SUIT_COLORS.forEach((color) => {
  const swatch = document.createElement('button');
  swatch.className = 'color-swatch';
  swatch.style.background = color;
  swatch.addEventListener('click', () => selectColor(color, swatch));
  colorPicker.appendChild(swatch);
});

selectColor(DEFAULT_SUIT_COLOR, colorPicker.firstElementChild);

let hatIndex = 0;

function cycleHat(step) {
  hatIndex = (hatIndex + step + HATS.length) % HATS.length;
  setHat(joinCharacter, HATS[hatIndex].id);
}

document.querySelector('#hat-prev').addEventListener('click', () => cycleHat(-1));
document.querySelector('#hat-next').addEventListener('click', () => cycleHat(1));

function stopSelfieCamera() {
  if (!selfieStream) return;
  selfieStream.getTracks().forEach((track) => track.stop());
  selfieStream = null;
  selfieVideo.srcObject = null;
}

async function startSelfieCamera() {
  selfieStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  selfieVideo.srcObject = selfieStream;
  await selfieVideo.play();
  // The video is layered over the visor while filming, since the helmet
  // behind it is opaque.
  document.querySelector('#join-visor-photo').classList.add('hidden');
  selfieVideo.classList.remove('hidden');
  selfieButton.textContent = texts.captureSelfieButton;
}

function captureSelfie() {
  // Crop the camera frame to the visor's own shape, exactly the way the live
  // preview does. Cropping to a square here instead would get cropped again
  // by the taller visor, so the saved photo came out tighter than what the
  // player framed.
  const { videoWidth, videoHeight } = selfieVideo;
  let sourceWidth = videoWidth;
  let sourceHeight = videoWidth / PHOTO_ASPECT;
  if (sourceHeight > videoHeight) {
    sourceHeight = videoHeight;
    sourceWidth = videoHeight * PHOTO_ASPECT;
  }
  const sourceX = (videoWidth - sourceWidth) / 2;
  const sourceY = (videoHeight - sourceHeight) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_WIDTH;
  canvas.height = PHOTO_HEIGHT;
  const context = canvas.getContext('2d');
  // Mirror it so the saved photo matches the mirrored preview the player saw.
  context.translate(PHOTO_WIDTH, 0);
  context.scale(-1, 1);
  context.drawImage(
    selfieVideo,
    sourceX, sourceY, sourceWidth, sourceHeight,
    0, 0, PHOTO_WIDTH, PHOTO_HEIGHT,
  );

  photoDataUrl = canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
  stopSelfieCamera();

  selfieVideo.classList.add('hidden');
  setVisorPhoto('join', photoDataUrl);
  selfieButton.textContent = texts.retakeSelfieButton;
}

async function handleSelfieClick() {
  if (selfieStream) {
    captureSelfie();
    return;
  }

  try {
    await startSelfieCamera();
  } catch {
    stopSelfieCamera();
    selfieVideo.classList.add('hidden');
    selfieButton.textContent = texts.takeSelfieButton;
    showPopup('error', texts.selfieError);
    setTimeout(hidePopup, ERROR_POPUP_DURATION_MS);
  }
}

function handleJoinClick() {
  const name = joinNameInput.value.trim();
  if (!name) return;

  joinButton.disabled = true;
  if (!socket) {
    socket = io(SERVER_URL);
    // Kept for the whole session, not just the join handshake, so the lobby
    // stays live as other players join or leave while everyone waits.
    socket.on('players', renderLobby);
  }

  function cleanup() {
    socket.off('connect', onConnect);
    socket.off('connect_error', onConnectError);
  }

  function onConnect() {
    cleanup();
    stopSelfieCamera(); // release the camera before leaving the join screen
    const hat = HATS[hatIndex].id;
    socket.emit('join', { name, photo: photoDataUrl, color: suitColor, hat });

    setSuitColor(menuCharacter, suitColor);
    setHat(menuCharacter, hat);
    if (photoDataUrl) {
      setVisorPhoto('menu', photoDataUrl);
    }

    openLobby();
  }

  function onConnectError() {
    cleanup();
    joinButton.disabled = false;
    showPopup('error', texts.joinError);
    setTimeout(hidePopup, ERROR_POPUP_DURATION_MS);
  }

  socket.on('connect', onConnect);
  socket.on('connect_error', onConnectError);
}

selfieButton.addEventListener('click', handleSelfieClick);
joinButton.addEventListener('click', handleJoinClick);
joinNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') handleJoinClick();
});
