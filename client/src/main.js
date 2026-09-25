import { io } from 'socket.io-client';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
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

// __COMMIT_HASH__ is baked in at build time (see vite.config.js) - shown on
// the join screen so it's easy to tell which deploy a phone is actually on.
const BUILD_ID = __COMMIT_HASH__;

// The selfie button is icon-only throughout its three states (idle,
// camera live/ready to shoot, photo taken) rather than switching between a
// small icon and long French labels - "CAPTURER"/"REPRENDRE" don't fit the
// compact square this button became once the hat arrows moved in next to
// it. All three read via currentColor, same as the button's own colour/glow.
const CAMERA_ICON = `<svg class="button-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M9.6 3a1 1 0 0 0-.8.4L7.5 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.5l-1.3-1.6a1 1 0 0 0-.8-.4H9.6zM12 8a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2z"/></svg>`;
const SHUTTER_ICON = `<svg class="button-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="5.2" fill="currentColor"/></svg>`;
const RETAKE_ICON = `<svg class="button-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 5V2L7 6l5 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>`;

// The satellite dish for the signal minigame. Drawn with currentColor so CSS
// gives it the app's cyan (see .dishgame-dish).
const DISH_ICON = `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><g transform="translate(0,400) scale(0.05,-0.05)" fill="currentColor"><path d="M4165 7859 c-971 -173 -1177 -1693 -420 -3091 49 -89 108 -191 133 -226 51 -70 53 -63 -75 -210 -300 -343 -229 -885 142 -1074 55 -29 74 -50 67 -74 -35 -114 -354 -1253 -376 -1340 -26 -104 -29 -107 -142 -153 -187 -76 -181 -67 -381 -601 -136 -365 -146 -407 -107 -482 268 -518 2868 -608 3577 -124 181 123 182 173 15 582 -253 619 -271 636 -743 716 -126 21 -157 33 -168 67 -17 58 -436 1090 -484 1195 -52 114 -47 115 101 17 914 -607 2153 -767 2964 -384 518 245 675 546 563 1079 -75 354 -359 953 -616 1298 l-48 64 46 276 c25 152 46 305 46 340 1 56 12 69 86 103 99 45 622 466 684 550 292 399 -570 1213 -1025 967 -51 -28 -444 -580 -509 -715 -3 -6 -112 -54 -242 -105 l-237 -94 -113 108 c-885 846 -2095 1425 -2738 1311z m506 -190 c510 -105 1271 -538 1946 -1107 l226 -191 -56 -25 c-32 -14 -466 -188 -967 -387 -500 -199 -962 -385 -1025 -414 -64 -28 -119 -47 -123 -43 -138 153 -482 709 -622 1003 -430 907 -202 1334 621 1164z m-894 -869 c509 -1576 3084 -3906 4338 -3925 456 -7 -375 -220 -865 -222 -761 -2 -1725 359 -2251 842 l-104 96 24 116 c86 413 -209 777 -638 785 l-168 4 -99 157 c-549 875 -719 2081 -370 2627 l45 70 14 -180 c8 -114 36 -250 74 -370z m4681 358 c301 -151 530 -536 401 -674 -181 -195 -740 190 -809 558 -34 180 166 237 408 116z m-499 -273 c87 -244 337 -477 606 -565 l98 -32 -167 -130 c-270 -212 -261 -208 -387 -180 -195 44 -399 234 -461 430 l-32 103 98 149 c54 83 119 184 144 225 25 41 52 75 60 75 8 0 26 -34 41 -75z m-487 -454 c20 -80 7 -90 -223 -184 -449 -184 -1097 -461 -1705 -730 -344 -152 -633 -277 -641 -277 -18 0 -151 160 -140 168 4 2 444 179 977 393 534 213 1128 452 1320 531 405 165 395 163 412 99z m90 -236 c12 -25 54 -78 92 -117 l69 -73 -47 -92 c-25 -50 -50 -92 -56 -92 -23 -2 -307 327 -290 333 11 4 56 24 100 45 104 49 105 49 132 -4z m-57 -527 c10 -17 -107 -241 -327 -622 -188 -328 -425 -742 -525 -920 -101 -178 -190 -325 -200 -325 -106 -6 -1516 1288 -1459 1340 19 17 558 254 1476 650 l660 285 180 -191 c99 -105 187 -202 195 -217z m400 240 c49 -18 49 -18 -98 -281 -184 -329 -472 -863 -797 -1477 -319 -604 -279 -543 -335 -512 -112 61 -126 80 -96 127 40 65 906 1575 1089 1901 94 166 165 272 179 265 13 -6 39 -17 58 -23z m250 -98 c3 -2 -15 -128 -39 -280 l-43 -276 -63 75 -63 74 34 174 c51 264 81 305 174 233z m-212 -685 c662 -927 924 -1765 630 -2011 -267 -222 -849 -105 -1562 315 l-191 112 119 225 c109 205 294 556 686 1299 80 151 150 275 155 275 6 0 79 -97 163 -215z m-3496 -797 c264 -90 408 -430 291 -688 -230 -508 -990 -326 -954 229 22 353 336 570 663 459z m396 -921 c56 -50 45 -67 -43 -67 -89 0 -96 10 -47 63 41 45 45 45 90 4z m-173 -777 c51 -286 114 -641 141 -788 71 -389 95 -350 -206 -334 -327 18 -845 107 -845 145 0 5 78 286 172 624 95 337 191 683 213 768 l40 155 112 1 c62 1 145 12 183 26 87 30 71 78 190 -597z m190 590 l95 0 46 -115 c25 -63 62 -152 82 -198 133 -303 515 -1274 507 -1288 -19 -29 -621 -138 -639 -115 -3 3 -21 105 -40 226 -38 242 -246 1391 -265 1468 -11 45 -8 47 54 35 36 -7 108 -13 160 -13z m1072 -1619 c666 -125 -20 -341 -1085 -341 -687 0 -1347 108 -1347 220 0 63 99 85 195 44 569 -244 2172 -175 2071 89 -9 24 -3 29 26 20 21 -7 84 -21 140 -32z m-2412 -251 c415 -215 2089 -227 2612 -18 157 62 140 70 216 -97 142 -313 216 -530 195 -570 -54 -101 -488 -235 -953 -297 -963 -126 -2430 76 -2430 335 0 52 198 556 244 622 45 64 41 64 116 25z"/></g></svg>`;

preloadAssets();
initBackground();

// Keeps the screen from locking, no matter which screen the app is showing -
// requested once up front and re-requested whenever the tab comes back into
// view, since the lock auto-releases the moment it's hidden (screen off,
// app switched away). Not supported everywhere (iOS Safari only from 16.4),
// so this silently does nothing on a browser without it.
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => {
      wakeLock = null;
    });
  } catch {
    // Denied, unsupported, or the page wasn't visible - nothing to do.
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wakeLock) {
    requestWakeLock();
  }
});

requestWakeLock();

// The waiting room between joining and the menu: one slot per possible
// player, filled in as people join (see renderLobby below).
const LOBBY_SLOT_COUNT = 10;

// Matches the server's own cap (see index.js) - the HTML attribute below
// stops normal typing/pasting, and the input handler further down is a
// defensive backstop for anything that might slip past it.
const NAME_MAX_LENGTH = 20;

// Matches the server's own cap (see MAX_CHAT_LENGTH in server/index.js).
const CHAT_MAX_LENGTH = 300;

// How many obstacles the jump game requires to win.
const DINO_TARGET_COUNT = 15;

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

    <button id="lobby-back-button" class="lobby-back-button hidden" aria-label="${texts.backButtonLabel}">‹</button>

    <div id="join-screen" class="screen">
      <p class="build-id">${BUILD_ID}</p>
      <div class="screen-fit home-buttons">
        <div class="character-panel">
          <div class="character-frame character-frame-large" id="join-character">
            <video id="selfie-video" class="character-video hidden" playsinline muted></video>
            ${characterMarkup('join')}
          </div>
        </div>

        <div class="color-picker" id="color-picker"></div>

        <div class="selfie-row">
          <button id="selfie-button" class="test-button selfie-button" aria-label="${texts.takeSelfieButton}">${CAMERA_ICON}</button>
          <div class="hat-arrows-panel">
            <div class="hat-arrows">
              <button id="hat-prev" class="hat-arrow" aria-label="${texts.previousHat}">◀</button>
              <button id="hat-next" class="hat-arrow" aria-label="${texts.nextHat}">▶</button>
            </div>
          </div>
        </div>

        <input id="join-name-input" class="name-input" type="text" placeholder="${texts.namePrompt}" maxlength="${NAME_MAX_LENGTH}" />
        <button id="join-button" class="test-button">${texts.joinButton}</button>
      </div>
    </div>

    <div id="lobby-screen" class="screen hidden">
      <div class="screen-fit lobby">
        <div class="lobby-grid">
          ${Array.from({ length: LOBBY_SLOT_COUNT }, (_, index) => lobbySlotMarkup(index)).join('')}
        </div>

        <button id="play-button" class="test-button">${texts.playButton}</button>
      </div>
    </div>

    <div id="home-screen" class="screen hidden">
      <p class="build-id">${BUILD_ID}</p>
      <div class="screen-fit home-buttons">
        <p class="session-label" id="session-label"></p>

        <div class="tasks-panel">
          <ul class="tasks-list" id="tasks-list"></ul>
          <canvas class="interference-canvas hidden" id="tasks-interference-canvas"></canvas>
        </div>

        <button id="test-minigames-button" class="test-button">${texts.testMinigamesButton}</button>

        <div class="scan-button-wrap">
          <button id="scan-button" class="test-button">${texts.scanButton}</button>
          <canvas class="interference-canvas hidden" id="scan-interference-canvas"></canvas>
        </div>

        <button id="mort-button" class="test-button test-button-danger">${texts.mortButton}</button>

        <button id="disconnect-button" class="test-button test-button-danger">${texts.disconnectButton}</button>

        <button id="fullscreen-button" class="fullscreen-button" aria-label="${texts.fullscreenButton}">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="fsV1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#a3f3ff"/>
                <stop offset="100%" stop-color="#38b6ff"/>
              </linearGradient>
            </defs>
            <path d="M 70 35 L 45 35 C 39 35, 35 39, 35 45 L 35 70" fill="none" stroke="#101419" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 70 35 L 45 35 C 39 35, 35 39, 35 45 L 35 70" fill="none" stroke="url(#fsV1Grad)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 130 35 L 155 35 C 161 35, 165 39, 165 45 L 165 70" fill="none" stroke="#101419" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 130 35 L 155 35 C 161 35, 165 39, 165 45 L 165 70" fill="none" stroke="url(#fsV1Grad)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 35 130 L 35 155 C 35 161, 39 165, 45 165 L 70 165" fill="none" stroke="#101419" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 35 130 L 35 155 C 35 161, 39 165, 45 165 L 70 165" fill="none" stroke="url(#fsV1Grad)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 165 130 L 165 155 C 165 161, 161 165, 155 165 L 130 165" fill="none" stroke="#101419" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M 165 130 L 165 155 C 165 161, 161 165, 155 165 L 130 165" fill="none" stroke="url(#fsV1Grad)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
            <polygon points="40,40 65,42 42,65" fill="url(#fsV1Grad)" stroke="#101419" stroke-width="6" stroke-linejoin="round"/>
            <polygon points="160,40 135,42 158,65" fill="url(#fsV1Grad)" stroke="#101419" stroke-width="6" stroke-linejoin="round"/>
            <polygon points="40,160 65,158 42,135" fill="url(#fsV1Grad)" stroke="#101419" stroke-width="6" stroke-linejoin="round"/>
            <polygon points="160,160 135,158 158,135" fill="url(#fsV1Grad)" stroke="#101419" stroke-width="6" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div id="minigames-screen" class="screen hidden">
      <div class="screen-fit home-buttons">
        <button id="minigames-back-button" class="minigames-back-button" aria-label="${texts.backToMenuLabel}">‹</button>

        <button id="test-button" class="test-button">${texts.testButton}</button>

        <button id="test-chat-button" class="test-button">${texts.testChatButton}</button>

        <button id="test-sort-button" class="test-button">${texts.testSortButton}</button>

        <button id="test-dino-button" class="test-button">${texts.testDinoButton}</button>

        <button id="test-dish-button" class="test-button">${texts.testDishButton}</button>

        <button id="alert-start-button" class="test-button test-button-danger">${texts.alertStartButton}</button>

        <button id="alert-stop-button" class="test-button">${texts.alertStopButton}</button>

        <button id="interference-button" class="test-button test-button-danger">${texts.interferenceButton}</button>
      </div>
    </div>

    <div id="minigame-screen" class="screen hidden">
      <div class="screen-fit minigame">
        <div class="minigame-instruction">
          <p class="minigame-instruction-label">${texts.miniGameInstruction}</p>
          <p class="minigame-code" id="minigame-code"></p>
        </div>
        <div class="keypad-panel">
          <div class="keypad" id="keypad"></div>
        </div>
      </div>
    </div>

    <div id="colorgame-screen" class="screen colorgame hidden">
      <div class="colorgame-instruction">
        <p class="minigame-instruction-label">${texts.colorGameInstruction}</p>
      </div>
      <div class="colorgame-board-panel">
        <div class="colorgame-board" id="colorgame-board"></div>
      </div>
      <div class="colorgame-counter" id="colorgame-counter">
        <div class="counter-dot"></div>
        <div class="counter-dot"></div>
        <div class="counter-dot"></div>
      </div>
    </div>

    <div id="dino-screen" class="screen dino hidden">
      <div class="dino-instruction">
        <p class="minigame-instruction-label">${texts.dinoInstruction}</p>
        <p class="dino-counter" id="dino-counter">0 / ${DINO_TARGET_COUNT}</p>
      </div>
      <div class="dino-track-panel">
        <div class="dino-track" id="dino-track">
          <div class="dino-character" id="dino-character"></div>
        </div>
      </div>
    </div>

    <div id="dishgame-screen" class="screen dishgame hidden">
      <div class="dishgame-instruction">
        <p class="minigame-instruction-label">${texts.dishInstruction}</p>
        <p class="dishgame-speed" id="dishgame-speed"></p>
      </div>
      <div class="dishgame-board-panel">
        <div class="dishgame-board" id="dishgame-board">
          <div class="dishgame-dish" id="dishgame-dish">${DISH_ICON}</div>
        </div>
      </div>
    </div>

    <div id="chat-screen" class="screen chat hidden">
      <div class="chat-header">
        <p class="chat-title">${texts.chatTitle}</p>
        <button id="chat-close-button" class="chat-close-button" aria-label="${texts.closeButtonLabel}">×</button>
      </div>
      <div class="chat-messages" id="chat-messages"></div>
      <form class="chat-form" id="chat-form">
        <input id="chat-input" class="chat-input" type="text" placeholder="${texts.chatPlaceholder}" maxlength="${CHAT_MAX_LENGTH}" autocomplete="off" />
        <button type="submit" class="chat-send-button">${texts.chatSendButton}</button>
      </form>
    </div>

    <div class="role-reveal hidden" id="role-reveal-screen">
      <p class="role-reveal-text" id="role-reveal-text"></p>
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

    <div class="confirm-popup hidden" id="mort-confirm-popup">
      <div class="confirm-panel">
        <p class="confirm-text">${texts.mortConfirmTitle}</p>
        <div class="confirm-buttons">
          <button id="mort-confirm-yes" class="test-button test-button-danger">${texts.mortConfirmYes}</button>
          <button id="mort-confirm-cancel" class="test-button">${texts.mortConfirmCancel}</button>
        </div>
      </div>
    </div>
  </div>
`;

// Sibling of #app (like #alert-overlay in index.html), not nested inside it -
// #app is a positioned stacking context (z-index:1, see style.css), so any
// z-index set on something living *inside* it is only ever compared against
// other things inside it, never against #alert-overlay outside it. That
// trapped the mort screen under the alert flash (z-index:3) no matter how
// high its own z-index was set. Living at the same level as #alert-overlay
// lets its z-index (45, in style.css) actually win against it.
document.querySelector('#alert-overlay').insertAdjacentHTML(
  'afterend',
  `
    <div class="mort-overlay hidden" id="mort-overlay">
      <button id="mort-close-button" class="mort-close-button" aria-label="${texts.closeButtonLabel}">×</button>
      <span class="mort-skull mort-skull-tl" aria-hidden="true">💀</span>
      <span class="mort-skull mort-skull-tr" aria-hidden="true">💀</span>
      <span class="mort-skull mort-skull-bl" aria-hidden="true">💀</span>
      <span class="mort-skull mort-skull-br" aria-hidden="true">💀</span>
      <div class="mort-qr-panel">
        <canvas id="mort-qr-canvas"></canvas>
      </div>
    </div>
  `,
);

// The title sits in a fixed panel, outside the flow, so the screens below it
// don't know how tall it is and tall content (a hat, for instance) slides
// underneath. Measure it and reserve exactly that much room at the top.
const titlePanel = document.querySelector('.title-panel');
const homeLayout = document.querySelector('.home');
const TITLE_GAP_PX = 12;
const SCREEN_BOTTOM_GAP_PX = 16;

// Screens that get shrunk to fit rather than sized with vh units, because
// their content is a flat stack (character, buttons, a keypad) with no
// pixel math that a scale transform could throw off. The colorgame and dino
// screens are deliberately left out: they read/animate real, untransformed
// pixel positions (drag-and-drop, jump physics), so they're sized with
// fixed/vh-relative CSS instead (see .colorgame-board and .dino-track in
// style.css).
const FIT_SCREEN_SELECTOR = '#join-screen, #lobby-screen, #home-screen, #minigames-screen, #minigame-screen';

// The title only shows on the join screen (see openLobby/handleDisconnectClick
// below); everywhere else it's hidden so the game screens get the full
// height instead of leaving a gap where it used to be.
function syncTitleSpace() {
  const titleVisible = !titlePanel.classList.contains('hidden');
  const space = titleVisible
    ? titlePanel.getBoundingClientRect().bottom + TITLE_GAP_PX
    : SCREEN_BOTTOM_GAP_PX; // same small margin as the bottom, for symmetry
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

const minigamesScreen = document.querySelector('#minigames-screen');
const testMinigamesButton = document.querySelector('#test-minigames-button');
const minigamesBackButton = document.querySelector('#minigames-back-button');

function openMinigamesMenu() {
  homeScreen.classList.add('hidden');
  minigamesScreen.classList.remove('hidden');
  pushOverlayState();
  fitActiveScreen();
}

function closeMinigamesMenu() {
  minigamesScreen.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  fitActiveScreen();
  closeOverlayState();
}

testMinigamesButton.addEventListener('click', openMinigamesMenu);
minigamesBackButton.addEventListener('click', closeMinigamesMenu);

const testButton = document.querySelector('#test-button');

const minigameScreen = document.querySelector('#minigame-screen');
const minigameCode = document.querySelector('#minigame-code');
const keypad = document.querySelector('#keypad');
const minigamePopup = document.querySelector('#minigame-popup');
const minigamePopupText = document.querySelector('#minigame-popup-text');

const CODE_LENGTH = 4;
// Two symbols alongside the ten digits - a classic phone-keypad pairing -
// so the grid fills its 3-column layout evenly (12 keys, 4 full rows) and
// the code itself can include them too, not just show them as decoration.
const KEYPAD_SYMBOLS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '#'];
const ERROR_POPUP_DURATION_MS = 1000;
const SUCCESS_SOUND_DELAY_MS = 500;

let code = [];
let position = 0;
let inputLocked = false;

function playDigitTone(symbol) {
  // Same beep sample, pitched up one semitone per key's position in
  // KEYPAD_SYMBOLS (0 = recorded pitch, 11 = eleven semitones higher) so
  // every key has its own tone, digits and the two symbols alike.
  const tone = sounds.beep.cloneNode();
  tone.preservesPitch = false;
  tone.mozPreservesPitch = false;
  tone.webkitPreservesPitch = false;
  tone.playbackRate = 2 ** (KEYPAD_SYMBOLS.indexOf(symbol) / 12);
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

function createKeypadButton(symbol) {
  const button = document.createElement('button');
  button.className = 'keypad-button';
  button.textContent = symbol;
  button.addEventListener('click', () => handleDigitTap(symbol));
  return button;
}

function renderKeypad() {
  keypad.innerHTML = '';
  shuffled(KEYPAD_SYMBOLS).forEach((symbol) => keypad.appendChild(createKeypadButton(symbol)));
}

function randomCode(length) {
  return Array.from({ length }, () => KEYPAD_SYMBOLS[Math.floor(Math.random() * KEYPAD_SYMBOLS.length)]);
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
  minigamesScreen.classList.add('hidden');
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
  minigamesScreen.classList.remove('hidden');
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

function handleDigitTap(symbol) {
  if (inputLocked) return;

  if (symbol === code[position]) {
    playDigitTone(symbol);
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

const testSortButton = document.querySelector('#test-sort-button');

const disconnectButton = document.querySelector('#disconnect-button');
disconnectButton.addEventListener('click', handleDisconnectClick);

// Broadcast to every connected phone (see the 'alert' listener in
// connectSocket below) - not just this one, unlike role/tasks.
const alertOverlay = document.querySelector('#alert-overlay');
const alertStartButton = document.querySelector('#alert-start-button');
const alertStopButton = document.querySelector('#alert-stop-button');

const alertTimer = document.querySelector('#alert-timer');
const alertTimerFill = document.querySelector('#alert-timer-fill');

// The server sends how much of the countdown is left, never a clock time
// (phone clocks disagree): the bar jumps to that fraction, then a CSS
// transition empties it over exactly that long. The server also says when
// it has run out, which is what actually hides it.
function setAlertState({ active, remainingMs = 0, durationMs = 1 }) {
  alertOverlay.classList.toggle('active', active);
  if (active !== alertIsActive) {
    alertIsActive = active;
    renderTasks(lastTasks);
  }
  const showTimer = active && remainingMs > 0;
  alertTimer.classList.toggle('hidden', !showTimer);
  if (!showTimer) return;

  alertTimerFill.style.transition = 'none';
  alertTimerFill.style.transform = `scaleX(${remainingMs / durationMs})`;
  alertTimerFill.getBoundingClientRect(); // commit that starting width before animating from it
  alertTimerFill.style.transition = `transform ${remainingMs}ms linear`;
  alertTimerFill.style.transform = 'scaleX(0)';
}

alertStartButton.addEventListener('click', () => { if (socket) socket.emit('alertStart'); });
alertStopButton.addEventListener('click', () => { if (socket) socket.emit('alertStop'); });

// Broadcast, same as alert - blanks the scanner and task list on every
// phone at once with procedural static (canvas, not the reference image -
// see interference-canvas in style.css) until the server says it's over.
const interferenceButton = document.querySelector('#interference-button');
const tasksInterferenceCanvas = document.querySelector('#tasks-interference-canvas');
const scanInterferenceCanvas = document.querySelector('#scan-interference-canvas');
const INTERFERENCE_REDRAW_MS = 100;
let interferenceTimer = null;

function drawStaticNoise(canvas) {
  const width = canvas.clientWidth || canvas.parentElement.clientWidth;
  const height = canvas.clientHeight || canvas.parentElement.clientHeight;
  // Downscaled and stretched back up via CSS image-rendering:pixelated for
  // a blocky TV-static look rather than full-resolution grey mush - kept
  // small enough that individual pixels are still visible as pixels.
  canvas.width = Math.max(1, Math.round(width / 2));
  canvas.height = Math.max(1, Math.round(height / 2));

  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const shade = Math.floor(Math.random() * 256);
    imageData.data[i] = shade;
    imageData.data[i + 1] = shade;
    imageData.data[i + 2] = shade;
    imageData.data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

function setInterferenceActive(active) {
  tasksInterferenceCanvas.classList.toggle('hidden', !active);
  scanInterferenceCanvas.classList.toggle('hidden', !active);
  scanButton.disabled = active;

  if (interferenceTimer) {
    clearInterval(interferenceTimer);
    interferenceTimer = null;
  }
  if (active) {
    drawStaticNoise(tasksInterferenceCanvas);
    drawStaticNoise(scanInterferenceCanvas);
    interferenceTimer = setInterval(() => {
      drawStaticNoise(tasksInterferenceCanvas);
      drawStaticNoise(scanInterferenceCanvas);
    }, INTERFERENCE_REDRAW_MS);
  }
}

interferenceButton.addEventListener('click', () => { if (socket) socket.emit('interferenceStart'); });

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
    // This minigame is the "Tri" task - tell the server in case it's one
    // of this player's 6 assigned tasks, so their task list can update.
    // No-op server-side (and no visible effect here) if it isn't.
    if (socket) socket.emit('completeTask', { taskId: 'sort' });
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
  minigamesScreen.classList.add('hidden');
  colorGameScreen.classList.remove('hidden');
  pushOverlayState();
  activeGameClose = closeColorGame;
  resetCounter();
  newColorRound();
}

function closeColorGame() {
  hidePopup();
  colorGameScreen.classList.add('hidden');
  minigamesScreen.classList.remove('hidden');
  fitActiveScreen();
  closeOverlayState();
}

testSortButton.addEventListener('click', openColorGame);

const dinoScreen = document.querySelector('#dino-screen');
const dinoTrack = document.querySelector('#dino-track');
const dinoCharacter = document.querySelector('#dino-character');
const dinoCounter = document.querySelector('#dino-counter');
const testDinoButton = document.querySelector('#test-dino-button');

// Must match .dino-character's own width/height in style.css - the jump
// physics below work in these same units, not measured from the DOM, so a
// mismatch would make the visuals and the actual hit-test disagree.
// Obstacles vary in height per spawnDinoObstacle below, so unlike the dino's
// own size there's no single OBSTACLE_HEIGHT constant to match against.
const DINO_SIZE = 34;
const OBSTACLE_WIDTH = 20;
const DINO_X = 30; // matches .dino-character's fixed `left`

const DINO_GRAVITY = 2200; // px/s^2, pulls the jump back down
const DINO_JUMP_SPEED = 650; // px/s, upward speed set at the moment of a tap
const OBSTACLE_BASE_SPEED = 300; // px/s at the start of a run
const OBSTACLE_MAX_SPEED_MULTIPLIER = 1.6; // 60% faster once all are cleared
// A jump keeps the dino in the air for ~0.6 s (2 * DINO_JUMP_SPEED /
// DINO_GRAVITY), so obstacles much closer together than that couldn't all
// be cleared: 600 ms is the floor for a gap that's always jumpable.
const OBSTACLE_MIN_INTERVAL_MS = 600;
const OBSTACLE_MAX_INTERVAL_MS = 1000;
const OBSTACLE_MIN_HEIGHT = 24;
const OBSTACLE_MAX_HEIGHT = 54; // still well under the ~96px a full jump clears

let dinoGameActive = false;
let dinoAnimationFrame = null;
let dinoLastFrameTime = 0;
let dinoBottom = 0;
let dinoVelocity = 0;
let dinoClearedCount = 0;
let dinoObstacles = [];
let dinoNextObstacleAt = 0;

function updateDinoCounter() {
  dinoCounter.textContent = `${dinoClearedCount} / ${DINO_TARGET_COUNT}`;
}

// Ramps linearly from the base speed up to 30% faster as the run
// progresses towards its target clear count, so every obstacle already on screen
// speeds up together rather than each one keeping whatever speed it
// spawned at.
function currentObstacleSpeed() {
  const progress = Math.min(dinoClearedCount / DINO_TARGET_COUNT, 1);
  return OBSTACLE_BASE_SPEED * (1 + (OBSTACLE_MAX_SPEED_MULTIPLIER - 1) * progress);
}

function scheduleNextDinoObstacle(now) {
  dinoNextObstacleAt = now + OBSTACLE_MIN_INTERVAL_MS + Math.random() * (OBSTACLE_MAX_INTERVAL_MS - OBSTACLE_MIN_INTERVAL_MS);
}

function spawnDinoObstacle(trackWidth) {
  const el = document.createElement('div');
  el.className = 'dino-obstacle';
  const height = OBSTACLE_MIN_HEIGHT + Math.random() * (OBSTACLE_MAX_HEIGHT - OBSTACLE_MIN_HEIGHT);
  el.style.height = `${height}px`;
  dinoTrack.appendChild(el);
  dinoObstacles.push({ el, x: trackWidth, height, resolved: false });
}

function dinoJump() {
  if (!dinoGameActive || dinoBottom > 0) return; // no double-jumping mid-air
  dinoVelocity = DINO_JUMP_SPEED;
}

// Resets a run's state without touching whether the game is open - shared
// by both the very first start and every restart after a fail below.
function resetDinoRun() {
  dinoObstacles.forEach((obstacle) => obstacle.el.remove());
  dinoObstacles = [];
  dinoClearedCount = 0;
  dinoBottom = 0;
  dinoVelocity = 0;
  dinoCharacter.style.bottom = '0px';
  updateDinoCounter();
}

function startDinoRun() {
  dinoGameActive = true;
  dinoLastFrameTime = performance.now();
  scheduleNextDinoObstacle(dinoLastFrameTime);
  dinoAnimationFrame = requestAnimationFrame(dinoStep);
}

function dinoWin() {
  dinoGameActive = false;
  cancelAnimationFrame(dinoAnimationFrame);
  // TODO: swap sounds.success for a dedicated general-task sound once provided.
  showPopup('success', texts.taskSuccess);
  playSuccessSoundThenClose();
}

// Unlike the other minigames (see docs/MINIGAMES.md's "no fail state"
// design rule), touching an obstacle here does end the run: show the same
// error-popup-then-retry pattern the door keypad uses for a wrong digit,
// then start over from 0 rather than exiting back to the submenu.
function dinoFail() {
  dinoGameActive = false;
  cancelAnimationFrame(dinoAnimationFrame);
  showPopup('error', texts.dinoFail);
  sounds.error.currentTime = 0;
  sounds.error.play().catch(() => {}); // browser may block autoplay in edge cases; sound is non-essential
  setTimeout(() => {
    hidePopup();
    resetDinoRun();
    startDinoRun();
  }, ERROR_POPUP_DURATION_MS);
}

function dinoStep(now) {
  if (!dinoGameActive) return;
  // Clamped so a dropped/backgrounded tab resuming doesn't take one giant
  // physics step and teleport the dino or an obstacle across the whole track.
  const dt = Math.min((now - dinoLastFrameTime) / 1000, 0.05);
  dinoLastFrameTime = now;

  dinoVelocity -= DINO_GRAVITY * dt;
  dinoBottom = Math.max(0, dinoBottom + dinoVelocity * dt);
  if (dinoBottom === 0) dinoVelocity = 0;
  dinoCharacter.style.bottom = `${dinoBottom}px`;

  if (now >= dinoNextObstacleAt) {
    spawnDinoObstacle(dinoTrack.clientWidth);
    scheduleNextDinoObstacle(now);
  }

  const obstacleSpeed = currentObstacleSpeed();
  for (const obstacle of dinoObstacles) {
    if (obstacle.resolved) continue;
    obstacle.x -= obstacleSpeed * dt;
    obstacle.el.style.left = `${obstacle.x}px`;

    const horizontalOverlap = obstacle.x < DINO_X + DINO_SIZE && obstacle.x + OBSTACLE_WIDTH > DINO_X;
    if (horizontalOverlap && dinoBottom < obstacle.height) {
      obstacle.resolved = true;
      dinoFail();
      break; // dinoFail already stopped the run; nothing else here matters now
    }

    if (obstacle.x + OBSTACLE_WIDTH < DINO_X) {
      obstacle.resolved = true;
      obstacle.el.remove();
      dinoClearedCount += 1;
      updateDinoCounter();
    }
  }
  if (!dinoGameActive) return; // dinoFail fired mid-loop above
  dinoObstacles = dinoObstacles.filter((obstacle) => !obstacle.resolved);

  if (dinoClearedCount >= DINO_TARGET_COUNT) {
    dinoWin();
    return;
  }

  dinoAnimationFrame = requestAnimationFrame(dinoStep);
}

function openDinoGame() {
  minigamesScreen.classList.add('hidden');
  dinoScreen.classList.remove('hidden');
  pushOverlayState();
  activeGameClose = closeDinoGame;
  resetDinoRun();
  startDinoRun();
}

function closeDinoGame() {
  hidePopup();
  dinoGameActive = false;
  cancelAnimationFrame(dinoAnimationFrame);
  dinoObstacles.forEach((obstacle) => obstacle.el.remove());
  dinoObstacles = [];
  dinoScreen.classList.add('hidden');
  minigamesScreen.classList.remove('hidden');
  fitActiveScreen();
  closeOverlayState();
}

// The whole screen is the tap target, not just the track itself.
dinoScreen.addEventListener('pointerdown', dinoJump);
testDinoButton.addEventListener('click', openDinoGame);

// Signal minigame: drag the dish around the board to find the one hidden
// spot with the best connection. The spot is random every time and never
// shown - only the speed readout tells the player they're getting closer.
const dishScreen = document.querySelector('#dishgame-screen');
const dishBoard = document.querySelector('#dishgame-board');
const dish = document.querySelector('#dishgame-dish');
const dishSpeed = document.querySelector('#dishgame-speed');
const testDishButton = document.querySelector('#test-dish-button');

const DISH_WIDTH = 76.8;
const DISH_HEIGHT = 51.2;
const DISH_MIN_MBPS = 2;
const DISH_MAX_MBPS = 5000;
const DISH_WIN_RADIUS = 10; // px from the hidden spot that counts as full speed
const DISH_HOLD_MS = 1000; // how long full speed must be held to win
const DISH_MIN_START_DISTANCE = 0.3; // of the board's diagonal, so it never starts next to the spot
const DISH_FALLOFF = 0.6; // of the board's diagonal: any farther than this is the slowest speed

let dishPosition = { x: 0, y: 0 }; // the dish's centre, in board pixels
let dishTarget = { x: 0, y: 0 };
let dishDiagonal = 1;
let dishHoldTimer = null;
let dishWon = false;

function randomDishPoint(width, height) {
  return {
    x: DISH_WIDTH / 2 + Math.random() * (width - DISH_WIDTH),
    y: DISH_HEIGHT / 2 + Math.random() * (height - DISH_HEIGHT),
  };
}

// 0 far away, 1 on the spot. Squared, so most of the board reads slow and
// red and it only turns green close in; the speed then follows it on a log
// scale (2 Mb/s -> 5 Gb/s), climbing faster and faster the closer you get.
function dishSignal() {
  const distance = Math.hypot(dishPosition.x - dishTarget.x, dishPosition.y - dishTarget.y);
  if (distance <= DISH_WIN_RADIUS) return 1;
  const reach = dishDiagonal * DISH_FALLOFF - DISH_WIN_RADIUS;
  const closeness = Math.max(0, 1 - (distance - DISH_WIN_RADIUS) / reach);
  return closeness ** 2;
}

function formatSpeed(mbps) {
  if (mbps < 10) return `${mbps.toFixed(1).replace('.', ',')} Mb/s`; // so small moves still show a change
  if (mbps < 1000) return `${Math.round(mbps)} Mb/s`;
  return `${(mbps / 1000).toFixed(1).replace('.', ',')} Gb/s`;
}

function updateDish() {
  dish.style.left = `${dishPosition.x - DISH_WIDTH / 2}px`;
  dish.style.top = `${dishPosition.y - DISH_HEIGHT / 2}px`;

  const signal = dishSignal();
  const mbps = DISH_MIN_MBPS * (DISH_MAX_MBPS / DISH_MIN_MBPS) ** signal;
  const color = `hsl(${Math.round(signal * 120)}, 100%, 55%)`; // red -> green
  dishSpeed.textContent = formatSpeed(mbps);
  dishSpeed.style.color = color;
  dishSpeed.style.textShadow = `0 0 8px ${color}`;
  dishSpeed.classList.toggle('at-max', signal === 1); // fast flash: "hold it here"

  if (dishWon) return;
  if (signal === 1 && !dishHoldTimer) {
    dishHoldTimer = setTimeout(winDishGame, DISH_HOLD_MS);
  } else if (signal < 1 && dishHoldTimer) {
    clearTimeout(dishHoldTimer);
    dishHoldTimer = null;
  }
}

function winDishGame() {
  dishHoldTimer = null;
  dishWon = true;
  showPopup('success', texts.taskSuccess);
  playSuccessSoundThenClose();
}

function moveDishTo(event) {
  const rect = dishBoard.getBoundingClientRect();
  dishPosition = {
    x: Math.max(DISH_WIDTH / 2, Math.min(event.clientX - rect.left, rect.width - DISH_WIDTH / 2)),
    y: Math.max(DISH_HEIGHT / 2, Math.min(event.clientY - rect.top, rect.height - DISH_HEIGHT / 2)),
  };
  updateDish();
}

// The dish jumps to the finger anywhere on the board and follows it, rather
// than having to grab the dish itself first.
dishBoard.addEventListener('pointerdown', (event) => {
  if (dishWon) return;
  dishBoard.setPointerCapture(event.pointerId);
  moveDishTo(event);
});
dishBoard.addEventListener('pointermove', (event) => {
  if (dishWon || !dishBoard.hasPointerCapture(event.pointerId)) return;
  moveDishTo(event);
});

function newDishRound() {
  const { width, height } = dishBoard.getBoundingClientRect();
  dishDiagonal = Math.hypot(width - DISH_WIDTH, height - DISH_HEIGHT);
  dishPosition = { x: width / 2, y: height / 2 };
  do {
    dishTarget = randomDishPoint(width, height);
  } while (Math.hypot(dishTarget.x - dishPosition.x, dishTarget.y - dishPosition.y) < dishDiagonal * DISH_MIN_START_DISTANCE);
  dishWon = false;
  updateDish();
}

function openDishGame() {
  minigamesScreen.classList.add('hidden');
  dishScreen.classList.remove('hidden');
  pushOverlayState();
  activeGameClose = closeDishGame;
  newDishRound(); // after un-hiding, so the board has a real size to place things in
}

function closeDishGame() {
  clearTimeout(dishHoldTimer);
  dishHoldTimer = null;
  hidePopup();
  dishScreen.classList.add('hidden');
  minigamesScreen.classList.remove('hidden');
  fitActiveScreen();
  closeOverlayState();
}

testDishButton.addEventListener('click', openDishGame);

const testChatButton = document.querySelector('#test-chat-button');
const chatScreen = document.querySelector('#chat-screen');
const chatMessages = document.querySelector('#chat-messages');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#chat-input');
const chatCloseButton = document.querySelector('#chat-close-button');

// Every message gets its own little character, built the same way the
// lobby's tiny ones are. Each needs a DOM id that's unique across every
// message ever shown (not just the server's own message id, in case the
// chat log - and therefore ids - ever gets reset while messages from an
// earlier log are still on screen) - characterMarkup hangs the visor's
// gradient/clip-path defs off that id, and two messages sharing one would
// fight over the same defs.
let chatAvatarCounter = 0;

function clearChatEmptyState() {
  const empty = chatMessages.querySelector('.chat-empty');
  if (empty) empty.remove();
}

function showChatEmptyState() {
  const empty = document.createElement('p');
  empty.className = 'chat-empty';
  empty.textContent = texts.chatEmpty;
  chatMessages.appendChild(empty);
}

function appendChatMessage(message) {
  clearChatEmptyState();

  chatAvatarCounter += 1;
  const avatarId = `chat-avatar-${chatAvatarCounter}`;

  const row = document.createElement('div');
  row.className = 'chat-message';

  const avatarFrame = document.createElement('div');
  avatarFrame.className = 'character-frame character-frame-chat';
  avatarFrame.innerHTML = characterMarkup(avatarId); // our own trusted markup, not user data

  const nameEl = document.createElement('p');
  nameEl.className = 'chat-message-name';
  nameEl.textContent = message.name;

  const textEl = document.createElement('p');
  textEl.className = 'chat-message-text';
  textEl.textContent = message.text;

  const body = document.createElement('div');
  body.className = 'chat-message-body';
  body.appendChild(nameEl);
  body.appendChild(textEl);

  row.appendChild(avatarFrame);
  row.appendChild(body);
  // Attached to the document before setVisorPhoto runs: it looks up the
  // visor image by id with document.querySelector, which can't find
  // anything inside a node that isn't part of the document yet - calling
  // it any earlier silently threw and dropped the whole message every time
  // its sender had a selfie set.
  chatMessages.appendChild(row);

  setSuitColor(avatarFrame, message.color || DEFAULT_SUIT_COLOR);
  setHat(avatarFrame, message.hat || DEFAULT_HAT);
  if (message.photo) setVisorPhoto(avatarId, message.photo);

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderChatHistory(messages) {
  chatMessages.innerHTML = '';
  if (messages.length === 0) {
    showChatEmptyState();
    return;
  }
  messages.forEach(appendChatMessage);
}

function openChat() {
  minigamesScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  pushOverlayState();
  chatMessages.scrollTop = chatMessages.scrollHeight;
  chatInput.focus();
}

function closeChat() {
  chatScreen.classList.add('hidden');
  minigamesScreen.classList.remove('hidden');
  fitActiveScreen();
  closeOverlayState();
}

testChatButton.addEventListener('click', openChat);
chatCloseButton.addEventListener('click', closeChat);

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !socket) return;
  socket.emit('chatMessage', { text });
  chatInput.value = '';
});

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

// A local, personal "I'm dead" screen - not broadcast to anyone else. The
// QR code carries this player's name so another phone could scan it later
// (e.g. reporting the body), but nothing here talks to the server.
const mortButton = document.querySelector('#mort-button');
const mortOverlay = document.querySelector('#mort-overlay');
const mortCloseButton = document.querySelector('#mort-close-button');
const mortQrCanvas = document.querySelector('#mort-qr-canvas');
const mortConfirmPopup = document.querySelector('#mort-confirm-popup');
const mortConfirmYesButton = document.querySelector('#mort-confirm-yes');
const mortConfirmCancelButton = document.querySelector('#mort-confirm-cancel');

// One accidental tap shouldn't end someone's game - a confirmation step
// comes first (see openMortConfirm below), same depth-stacking pattern as
// the minigames menu opening a sub-game (push once per screen, no
// closeOverlayState in between - see openMiniGame for the same shape).
function openMortScreen() {
  const name = (currentIdentity && currentIdentity.name) || '';
  QRCode.toCanvas(mortQrCanvas, `${name} ${texts.mortQrPayload}`, { width: 220, margin: 1 });
  mortOverlay.classList.remove('hidden');
  pushOverlayState();
}

function closeMortScreen() {
  mortOverlay.classList.add('hidden');
  closeOverlayState();
}

function openMortConfirm() {
  mortConfirmPopup.classList.remove('hidden');
  pushOverlayState();
}

function closeMortConfirm() {
  mortConfirmPopup.classList.add('hidden');
  closeOverlayState();
}

mortButton.addEventListener('click', openMortConfirm);
mortConfirmCancelButton.addEventListener('click', closeMortConfirm);
mortConfirmYesButton.addEventListener('click', () => {
  mortConfirmPopup.classList.add('hidden');
  openMortScreen();
});
mortCloseButton.addEventListener('click', closeMortScreen);

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
  } else if (!mortOverlay.classList.contains('hidden')) {
    closeMortScreen();
  } else if (!mortConfirmPopup.classList.contains('hidden')) {
    closeMortConfirm();
  } else if (!colorGameScreen.classList.contains('hidden')) {
    closeColorGame();
  } else if (!dinoScreen.classList.contains('hidden')) {
    closeDinoGame();
  } else if (!dishScreen.classList.contains('hidden')) {
    closeDishGame();
  } else if (!chatScreen.classList.contains('hidden')) {
    closeChat();
  } else if (!minigamesScreen.classList.contains('hidden')) {
    closeMinigamesMenu();
  }
  closingFromPopState = false;
});

const joinScreen = document.querySelector('#join-screen');
const joinNameInput = document.querySelector('#join-name-input');
const joinButton = document.querySelector('#join-button');
const selfieButton = document.querySelector('#selfie-button');

// No visible label in any of the button's three states (see the note on
// CAMERA_ICON above), so its accessible name has to come from aria-label
// instead of its own text content in every case.
function setSelfieButtonState(icon, label) {
  selfieButton.innerHTML = icon;
  selfieButton.setAttribute('aria-label', label);
}

const selfieVideo = document.querySelector('#selfie-video');
const joinCharacter = document.querySelector('#join-character');
const colorPicker = document.querySelector('#color-picker');

const lobbyScreen = document.querySelector('#lobby-screen');
const playButton = document.querySelector('#play-button');
const lobbyBackButton = document.querySelector('#lobby-back-button');
lobbyBackButton.addEventListener('click', () => handleDisconnectClick());
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
  updateColorAvailability(players);

  // The server has the final say on colour - it swaps a requested colour
  // for a free one when another player already holds it. Pick that up here
  // so a future reconnect re-joins with what we actually got, not what we
  // originally asked for.
  const self = players.find((player) => player.id === clientId);
  if (self && currentIdentity && self.color && self.color !== currentIdentity.color) {
    currentIdentity = { ...currentIdentity, color: self.color };
  }

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
  titlePanel.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  lobbyBackButton.classList.remove('hidden');
  syncLayout(); // hiding the title changes how much space screens get, not just their fit
}

function openMenuFromLobby() {
  inSession = true;
  lobbyScreen.classList.add('hidden');
  lobbyBackButton.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  fitActiveScreen();
}

// For a player already in the running session: skips the lobby entirely.
function openMenuDirect() {
  inSession = true;
  joinScreen.classList.add('hidden');
  titlePanel.classList.add('hidden');
  homeScreen.classList.remove('hidden');
  syncLayout();
}

const roleRevealScreen = document.querySelector('#role-reveal-screen');
const roleRevealText = document.querySelector('#role-reveal-text');

const ROLE_REVEAL_DURATION_MS = 3000;
const ROLE_REVEAL_FADE_MS = 600; // matches .role-reveal's own CSS transition duration
const ROLE_LABELS = { crewmate: texts.roleInnocent, imposter: texts.roleTraitor };
const ROLE_CLASSES = { crewmate: 'innocent', imposter: 'traitor' };

// Fades the screen to black, shows the player's own role on it for a few
// seconds, then fades back in on the menu underneath. The screen swap
// happens while still fully black (see the inner setTimeout below), so the
// fade-out reveals the menu rather than the lobby it covered up.
function showRoleReveal(role) {
  roleRevealText.textContent = ROLE_LABELS[role] || '';
  roleRevealText.classList.remove('innocent', 'traitor');
  roleRevealText.classList.add(ROLE_CLASSES[role] || 'innocent');
  roleRevealScreen.classList.remove('hidden');
  // Letting the browser paint the starting (opacity:0) state first is what
  // makes this fade in instead of jumping straight to fully visible.
  requestAnimationFrame(() => roleRevealScreen.classList.add('visible'));

  setTimeout(() => {
    openMenuFromLobby();
    roleRevealScreen.classList.remove('visible');
    setTimeout(() => roleRevealScreen.classList.add('hidden'), ROLE_REVEAL_FADE_MS);
  }, ROLE_REVEAL_DURATION_MS);
}

const tasksList = document.querySelector('#tasks-list');

// Tasks arrive from the server all-pending (see taskState.js) - there's no
// mini-game hooked up yet to actually mark one done, so every symbol shown
// here is the empty box for now; the done/green-check styling is already
// wired up for whenever a mini-game starts reporting completion.
let lastTasks = []; // kept so the list can be redrawn when the alert starts or stops
let alertIsActive = false;

function appendTaskItem(labelText, { done = false, alert = false } = {}) {
  const item = document.createElement('li');
  item.className = 'task-item';
  item.classList.toggle('task-done', done);
  item.classList.toggle('task-alert', alert);

  // Empty until done rather than an unchecked-box glyph - the check
  // mark is the only symbol this list ever shows.
  const box = document.createElement('span');
  box.className = 'task-checkbox';
  box.textContent = done ? '✓' : '';

  const label = document.createElement('span');
  label.className = 'task-label';
  label.textContent = labelText;

  item.appendChild(box);
  item.appendChild(label);
  tasksList.appendChild(item);
}

// While the alert is on, every player's list gets a red "Oxygène | Terrasse"
// row on top of their own tasks.
function renderTasks(tasks) {
  lastTasks = tasks;
  tasksList.innerHTML = '';
  if (alertIsActive) appendTaskItem(`${texts.oxygenTask} | ${texts.roomNames.terrace}`, { alert: true });
  tasks.forEach((task) => {
    const name = texts.taskNames[task.id] || task.id;
    const room = texts.roomNames[task.room];
    appendTaskItem(room ? `${name} | ${room}` : name, { done: task.done });
  });
}

// JOUER starts the session for the whole lobby, CONTINUER joins the running
// one - either way the role reveal arrives as a 'role' event (see handleRole),
// which is also how every other lobby player gets moved along by JOUER.
function handlePlayClick() {
  if (!socket) {
    openMenuFromLobby(); // shouldn't happen once joined, but never get stuck on the lobby
    return;
  }
  socket.emit('startGame');
}

playButton.addEventListener('click', handlePlayClick);

// A face shown at avatar size never needs more than this, and it keeps the
// photo at a few KB so it's cheap to send and to hold in server memory.
// The shape matches the visor's image box so the saved photo frames the face
// exactly like the live preview did.
const PHOTO_WIDTH = 132;
const PHOTO_HEIGHT = 216;
const PHOTO_ASPECT = PHOTO_WIDTH / PHOTO_HEIGHT;
const PHOTO_QUALITY = 0.6;

let socket = null;
let selfieStream = null;
let photoDataUrl = null;
let suitColor = DEFAULT_SUIT_COLOR;

// A stable id for this browser, separate from the chosen name/photo/colour:
// it's what lets the server recognise "this is the same player reconnecting"
// (a new tab, a phone waking back up) and replace their old entry instead of
// adding a duplicate. Made up once and kept for as long as this browser's
// storage lasts.
const CLIENT_ID_STORAGE_KEY = 'amongUsIrl.clientId';

function makeClientId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getOrCreateClientId() {
  try {
    const existing = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (existing) return existing;
    const created = makeClientId();
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, created);
    return created;
  } catch {
    // Storage blocked - fall back to a one-off id for this page load. It
    // just means this tab won't be recognised as "the same player" next
    // time, same as the saved identity above in that situation.
    return makeClientId();
  }
}

const clientId = getOrCreateClientId();

let currentIdentity = null; // { name, photo, color, hat } once we know who we are
let hasEnteredGame = false; // true once we've left the join screen this page load
let inSession = false; // true once we're past the lobby, in the running session's menu
// Mirrors of what the server last told us (see 'welcome'/'session'/'role'):
// which session is running, if any, and whether this phone is part of it.
let sessionId = null;
let isMember = false;
let welcomed = false; // the first welcome of a page load is the one that picks the starting screen
let latestPlayers = []; // last roster we heard from the server, for the colour picker

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
  swatch.dataset.color = color;
  swatch.addEventListener('click', () => selectColor(color, swatch));
  colorPicker.appendChild(swatch);
});

selectColor(DEFAULT_SUIT_COLOR, colorPicker.firstElementChild);

// Colours are unique per player (the server enforces this on join - see
// resolveColor in server/gameState.js), so the picker greys out and
// disables any colour someone else already holds, live, as players come
// and go. If our own current pick gets taken out from under us this way,
// we fall back to the next free one automatically instead of leaving a
// disabled swatch selected.
function updateColorAvailability(players) {
  latestPlayers = players;
  const takenByOthers = new Set(
    players.filter((player) => player.id !== clientId).map((player) => player.color),
  );

  colorPicker.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.disabled = takenByOthers.has(swatch.dataset.color);
  });

  if (takenByOthers.has(suitColor)) {
    const nextSwatch = Array.from(colorPicker.querySelectorAll('.color-swatch')).find(
      (swatch) => !takenByOthers.has(swatch.dataset.color),
    );
    if (nextSwatch) selectColor(nextSwatch.dataset.color, nextSwatch);
  }
}

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
  // The video is layered over the visor while filming, since the head/arms
  // silhouette behind it is opaque.
  document.querySelector('#join-visor-photo').classList.add('hidden');
  selfieVideo.classList.remove('hidden');
  setSelfieButtonState(SHUTTER_ICON, texts.captureSelfieButton);
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
  setSelfieButtonState(RETAKE_ICON, texts.retakeSelfieButton);
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
    setSelfieButtonState(CAMERA_ICON, texts.takeSelfieButton);
    showPopup('error', texts.selfieError);
    setTimeout(hidePopup, ERROR_POPUP_DURATION_MS);
  }
}

// Sends our identity to the server and, the first time this page load does
// so, moves on from the join screen: straight to the menu for a player
// already in the running session (the server sends their tasks back, or
// their role reveal if they never got it), the lobby for everyone else.
function sendJoin() {
  socket.emit('join', { ...currentIdentity, clientId });

  if (!hasEnteredGame) {
    hasEnteredGame = true;
    stopSelfieCamera(); // release the camera before leaving the join screen
    if (isMember) openMenuDirect();
    else openLobby();
  }
}

const sessionLabel = document.querySelector('#session-label');

// Everything on screen that depends on which session is running.
function updateSessionDisplay() {
  playButton.textContent = sessionId === null ? texts.playButton : texts.continueButton;
  sessionLabel.textContent = sessionId === null ? '' : `${texts.sessionLabel} ${sessionId}`;
}

function handleWelcome({ sessionId: currentSessionId, member, character }) {
  sessionId = currentSessionId;
  isMember = member;
  updateSessionDisplay();

  if (hasEnteredGame) {
    // Came back from a dropped connection. If the session we were playing
    // in is gone (everyone left, or the server restarted), a fresh page load
    // puts us wherever a newcomer belongs, with our character pre-filled.
    if (inSession && !member) {
      window.location.reload();
      return;
    }
    sendJoin(); // quietly reappear wherever we already were
    return;
  }

  // REJOINDRE was pressed while the connection was still (re)opening.
  if (currentIdentity) {
    sendJoin();
    return;
  }

  if (welcomed) return; // a reconnect while on the join screen shouldn't undo edits in progress
  welcomed = true;
  if (!character) return; // never played on this phone - just the blank character screen
  fillJoinForm(character);
  // No session: stay on the character screen. A session running: skip it.
  if (sessionId !== null) {
    currentIdentity = character;
    sendJoin();
  }
}

function handleRole({ role, tasks }) {
  isMember = true;
  renderTasks(tasks);
  showRoleReveal(role);
}

// One persistent connection, opened as soon as this page loads (even before
// the player has picked a name) so the join screen's colour picker can grey
// out colours other players already hold in real time - see renderLobby.
// Once an identity exists, every connect - the first join, and every one
// after (the phone woke up, the tab came back, a ping timed out and
// Socket.IO auto-reconnected) - re-announces it so the player quietly
// reappears wherever they already were, instead of getting sent back to
// the join screen.
function connectSocket() {
  if (socket) {
    // A disconnect the player asked for (see handleDisconnectClick) leaves
    // the socket around but deliberately not reconnecting - reopen it by
    // hand if they come back and join again.
    if (!socket.connected) socket.connect();
    return socket;
  }

  // WebSocket straight away, skipping Socket.IO's default start on HTTP
  // long-polling: behind a hosting proxy, polling replies can be held back,
  // which delayed lobby updates by seconds.
  socket = io(SERVER_URL, { transports: ['websocket'] });
  // Kept for the whole session, not just the join handshake, so the lobby
  // (and the join screen's colour picker, before that) stay live as other
  // players join or leave while everyone waits.
  socket.on('players', renderLobby);
  socket.on('chatHistory', renderChatHistory);
  socket.on('chatMessage', appendChatMessage);
  socket.on('tasks', renderTasks);
  socket.on('alert', setAlertState);
  socket.on('interference', ({ active }) => setInterferenceActive(active));
  socket.on('welcome', handleWelcome);
  socket.on('role', handleRole);
  socket.on('session', ({ sessionId: currentSessionId }) => {
    if (currentSessionId !== sessionId) isMember = false; // a new session's members hear 'role' right after
    sessionId = currentSessionId;
    updateSessionDisplay();
  });

  // Every connect, the first and every reconnect, starts by asking the
  // server where we stand - see handleWelcome.
  socket.on('connect', () => {
    socket.emit('hello', { clientId });
  });

  socket.on('connect_error', () => {
    if (hasEnteredGame || !currentIdentity) return; // no join in flight to fail
    joinButton.disabled = false;
    showPopup('error', texts.joinError);
    setTimeout(hidePopup, ERROR_POPUP_DURATION_MS);
  });

  return socket;
}

// Best-effort only: the Fullscreen API needs a direct user gesture to work
// at all (a click is one), and iOS Safari doesn't support it regardless -
// it just silently does nothing there. A toggle rather than a one-way
// request, so the same corner button (see fullscreenButton below) both
// enters and leaves it.
function toggleAppFullscreen() {
  try {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  } catch {
    // Some browsers throw synchronously rather than rejecting the promise.
  }
}

document.querySelector('#fullscreen-button').addEventListener('click', toggleAppFullscreen);

function handleJoinClick() {
  const name = joinNameInput.value.trim();
  if (!name) return;

  toggleAppFullscreen();
  joinButton.disabled = true;
  currentIdentity = { name, photo: photoDataUrl, color: suitColor, hat: HATS[hatIndex].id };
  const activeSocket = connectSocket();
  if (activeSocket.connected) sendJoin();
}

// Back to a blank join form, as if this browser had never joined.
function resetJoinForm() {
  joinNameInput.value = '';
  photoDataUrl = null;
  hatIndex = 0;
  stopSelfieCamera();
  selfieVideo.classList.add('hidden');
  setSelfieButtonState(CAMERA_ICON, texts.takeSelfieButton);
  clearVisorPhoto('join');
  setHat(joinCharacter, HATS[0].id);
  selectColor(DEFAULT_SUIT_COLOR, colorPicker.firstElementChild);
  updateColorAvailability(latestPlayers); // steps off DEFAULT_SUIT_COLOR above if it's now taken
  joinButton.disabled = false;
}

// The character screen, filled in with a character the server remembers
// (see server/characterStore.js) rather than starting blank.
function fillJoinForm({ name, photo, color, hat }) {
  resetJoinForm();
  joinNameInput.value = name || '';
  photoDataUrl = photo || null;
  if (photoDataUrl) {
    setVisorPhoto('join', photoDataUrl);
    setSelfieButtonState(RETAKE_ICON, texts.retakeSelfieButton);
  }
  hatIndex = Math.max(0, HATS.findIndex((item) => item.id === hat));
  setHat(joinCharacter, HATS[hatIndex].id);
  const swatch = colorPicker.querySelector(`.color-swatch[data-color="${color}"]`);
  if (swatch) selectColor(color, swatch);
  updateColorAvailability(latestPlayers); // steps off the saved colour if someone else holds it now
}

function handleDisconnectClick() {
  // A deliberate disconnect - not one Socket.IO should try to paper over by
  // silently reconnecting us, which is exactly why connectSocket() leaves a
  // disconnected socket alone instead of reopening it right away. The server
  // keeps our place in the session, so rejoining later picks it back up.
  if (socket) socket.disconnect();

  // What we last sent the server is exactly what it has stored for us.
  const lastIdentity = currentIdentity;
  currentIdentity = null;
  hasEnteredGame = false;
  inSession = false;

  // With the connection closed, this phone won't hear the server switch
  // these off (for instance when leaving ends the session), so it switches
  // them off itself. The next connection sends their real state anyway.
  setAlertState({ active: false });
  setInterferenceActive(false);

  // Reachable from either the menu's "SE DECONNECTER" or the lobby's back
  // button, so hide both regardless of which one is actually showing.
  homeScreen.classList.add('hidden');
  lobbyScreen.classList.add('hidden');
  lobbyBackButton.classList.add('hidden');
  if (lastIdentity) fillJoinForm(lastIdentity);
  else resetJoinForm();
  titlePanel.classList.remove('hidden');
  joinScreen.classList.remove('hidden');
  syncLayout();
}

selfieButton.addEventListener('click', handleSelfieClick);
joinButton.addEventListener('click', handleJoinClick);
joinNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') handleJoinClick();
});
joinNameInput.addEventListener('input', () => {
  if (joinNameInput.value.length > NAME_MAX_LENGTH) {
    joinNameInput.value = joinNameInput.value.slice(0, NAME_MAX_LENGTH);
  }
});

// Connects right away: the server's 'welcome' decides the starting screen
// (see handleWelcome), and until then the roster keeps the join screen's
// colour picker up to date.
connectSocket();
