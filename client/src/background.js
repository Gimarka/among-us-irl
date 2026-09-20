// The wall background is drawn as an inline SVG (rather than a CSS
// background-image) because animations inside an SVG don't run when the
// browser only uses it as a static background image. The tile's own
// coordinates stay fixed at 0-200; the <pattern>'s width/height (in real
// pixels) are kept at half the viewport width so it's always exactly two
// tiles wide, and the pattern's viewBox scales the drawing to fit.
const TILE_MARKUP = `
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <linearGradient id="tileBase" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3d444d"/>
        <stop offset="50%" stop-color="#323840"/>
        <stop offset="100%" stop-color="#282d33"/>
      </linearGradient>

      <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <filter id="pulseGlow" x="-150%" y="-150%" width="400%" height="400%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      <pattern id="wall-tile" patternUnits="userSpaceOnUse" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="url(#tileBase)"/>

        <g fill="none" stroke="#22262b" stroke-width="1.5" opacity="0.6">
          <line x1="25" y1="20" x2="65" y2="20"/>
          <line x1="25" y1="25" x2="65" y2="25"/>
          <line x1="25" y1="30" x2="65" y2="30"/>
          <line x1="135" y1="165" x2="175" y2="165"/>
          <line x1="135" y1="170" x2="175" y2="170"/>
          <line x1="135" y1="175" x2="175" y2="175"/>
        </g>

        <g stroke="#181a1d" stroke-width="6" fill="none" stroke-linecap="square">
          <line x1="0" y1="0" x2="200" y2="0"/>
          <line x1="0" y1="200" x2="200" y2="200"/>
          <line x1="0" y1="0" x2="0" y2="200"/>
          <line x1="200" y1="0" x2="200" y2="200"/>
          <path id="wire-1" d="M 60 0 L 60 60 L 140 140 L 140 200"/>
          <path id="wire-2" d="M 140 0 L 140 40 L 100 80 L 0 80"/>
          <path id="wire-3" d="M 200 80 L 160 80 L 100 80"/>
        </g>

        <g stroke="#525c66" stroke-width="1" fill="none">
          <path d="M 61 0 L 61 59 L 141 139 L 141 200"/>
          <path d="M 141 0 L 141 39 L 101 79 L 0 79"/>
        </g>

        <!-- Pulsing lights traveling along the wires -->
        <circle r="3" fill="#7be5ff" filter="url(#pulseGlow)">
          <animateMotion dur="3.2s" repeatCount="indefinite">
            <mpath href="#wire-1" xlink:href="#wire-1"/>
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="3.2s" repeatCount="indefinite"/>
        </circle>
        <circle r="3" fill="#7be5ff" filter="url(#pulseGlow)">
          <animateMotion dur="2.6s" begin="0.6s" repeatCount="indefinite">
            <mpath href="#wire-2" xlink:href="#wire-2"/>
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="2.6s" begin="0.6s" repeatCount="indefinite"/>
        </circle>
        <circle r="3" fill="#7be5ff" filter="url(#pulseGlow)">
          <animateMotion dur="2s" begin="1.3s" repeatCount="indefinite">
            <mpath href="#wire-3" xlink:href="#wire-3"/>
          </animateMotion>
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="2s" begin="1.3s" repeatCount="indefinite"/>
        </circle>

        <g fill="#00f0ff" filter="url(#nodeGlow)">
          <circle cx="100" cy="80" r="3.5"/>
          <circle cx="0" cy="0" r="4"/>
          <circle cx="200" cy="0" r="4"/>
          <circle cx="0" cy="200" r="4"/>
          <circle cx="200" cy="200" r="4"/>
        </g>
        <g fill="none" stroke="#181a1d" stroke-width="1.5">
          <circle cx="100" cy="80" r="6"/>
          <circle cx="0" cy="0" r="6"/>
          <circle cx="200" cy="0" r="6"/>
          <circle cx="0" cy="200" r="6"/>
          <circle cx="200" cy="200" r="6"/>
        </g>
      </pattern>
    </defs>

    <rect width="100%" height="100%" fill="url(#wall-tile)"/>
  </svg>
`;

export function initBackground() {
  const container = document.querySelector('#background-fx');
  container.innerHTML = TILE_MARKUP;
  const pattern = container.querySelector('#wall-tile');

  function updateTileSize() {
    const size = window.innerWidth / 2;
    pattern.setAttribute('width', size);
    pattern.setAttribute('height', size);
  }

  updateTileSize();
  window.addEventListener('resize', updateTileSize);
}
