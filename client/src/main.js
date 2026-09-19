import { texts } from './texts.fr.js';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <div class="home">
    <h1 class="home-title">${texts.homeTitle}</h1>
    <button id="test-button" class="test-button">${texts.testButton}</button>
    <p class="test-result hidden" id="test-result">${texts.testButtonClicked}</p>
  </div>
`;

const testButton = document.querySelector('#test-button');
const testResult = document.querySelector('#test-result');

testButton.addEventListener('click', () => {
  testResult.classList.remove('hidden');
});
