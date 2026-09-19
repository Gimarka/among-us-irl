import { Html5Qrcode } from 'html5-qrcode';
import { texts } from './texts.fr.js';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="home">
    <h1 class="home-title">${texts.homeTitle}</h1>

    <button id="test-button" class="test-button">${texts.testButton}</button>
    <p class="test-result hidden" id="test-result">${texts.testButtonClicked}</p>

    <button id="scan-button" class="test-button">${texts.scanButton}</button>
    <div id="qr-reader" class="qr-reader hidden"></div>
    <p class="test-result hidden" id="scan-result"></p>
    <button id="scan-again-button" class="test-button hidden">${texts.scanAgainButton}</button>
  </div>
`;

const testButton = document.querySelector('#test-button');
const testResult = document.querySelector('#test-result');

testButton.addEventListener('click', () => {
  testResult.classList.remove('hidden');
});

const scanButton = document.querySelector('#scan-button');
const scanAgainButton = document.querySelector('#scan-again-button');
const qrReader = document.querySelector('#qr-reader');
const scanResult = document.querySelector('#scan-result');

const html5QrCode = new Html5Qrcode('qr-reader');

function startScan() {
  scanButton.classList.add('hidden');
  scanAgainButton.classList.add('hidden');
  scanResult.classList.add('hidden');
  qrReader.classList.remove('hidden');

  html5QrCode
    .start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: 250 },
      (decodedText) => {
        html5QrCode.stop().then(() => {
          qrReader.classList.add('hidden');
          scanResult.textContent = `${texts.scanResultLabel} ${decodedText}`;
          scanResult.classList.remove('hidden');
          scanAgainButton.classList.remove('hidden');
        });
      },
      () => {} // fires every frame with no QR in view; nothing to do
    )
    .catch(() => {
      qrReader.classList.add('hidden');
      scanResult.textContent = texts.cameraError;
      scanResult.classList.remove('hidden');
      scanButton.classList.remove('hidden');
    });
}

scanButton.addEventListener('click', startScan);
scanAgainButton.addEventListener('click', startScan);
