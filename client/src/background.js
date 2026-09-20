// The wall is built as an explicit grid of <use> elements (rather than a
// single repeating <pattern>) so neighboring tiles can be slightly
// different from each other while still lining up seamlessly: every
// variant below shares the exact same seam/wire/node geometry (so edges
// always connect across tiles), and only the decorative vents, the pulse
// timing/routes and the base tint differ between variants.
//
// It has to be an inline SVG rather than a CSS background-image because
// animations inside an SVG don't run when the browser only uses it as a
// static background image.
const TILE_VARIANT_IDS = ['tile-a', 'tile-b', 'tile-c'];

// Shared geometry every variant must reuse unchanged so tile edges connect.
const SHARED_SEAMS_AND_WIRES = `
  <g stroke="#181a1d" stroke-width="6" fill="none" stroke-linecap="square">
    <line x1="0" y1="0" x2="200" y2="0"/>
    <line x1="0" y1="200" x2="200" y2="200"/>
    <line x1="0" y1="0" x2="0" y2="200"/>
    <line x1="200" y1="0" x2="200" y2="200"/>
    <path id="{ID}-wire-1" d="M 60 0 L 60 60 L 140 140 L 140 200"/>
    <path id="{ID}-wire-2" d="M 140 0 L 140 40 L 100 80 L 0 80"/>
    <path id="{ID}-wire-3" d="M 200 80 L 160 80 L 100 80"/>
  </g>
  <g stroke="#525c66" stroke-width="1" fill="none">
    <path d="M 61 0 L 61 59 L 141 139 L 141 200"/>
    <path d="M 141 0 L 141 39 L 101 79 L 0 79"/>
  </g>
`;

const SHARED_NODES = `
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
`;

function pulse(id, wireId, dur, begin) {
  return `
    <circle r="3" fill="#7be5ff" filter="url(#pulseGlow)">
      <animateMotion dur="${dur}" begin="${begin}" repeatCount="indefinite">
        <mpath href="#${id}-${wireId}" xlink:href="#${id}-${wireId}"/>
      </animateMotion>
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur="${dur}" begin="${begin}" repeatCount="indefinite"/>
    </circle>
  `;
}

const VARIANTS = [
  {
    id: 'tile-a',
    gradient: 'tileBaseA',
    vents: `
      <g fill="none" stroke="#22262b" stroke-width="1.5" opacity="0.6">
        <line x1="25" y1="20" x2="65" y2="20"/>
        <line x1="25" y1="25" x2="65" y2="25"/>
        <line x1="25" y1="30" x2="65" y2="30"/>
        <line x1="135" y1="165" x2="175" y2="165"/>
        <line x1="135" y1="170" x2="175" y2="170"/>
        <line x1="135" y1="175" x2="175" y2="175"/>
      </g>
    `,
    pulses: (id) => pulse(id, 'wire-1', '3.2s', '0s') + pulse(id, 'wire-2', '2.6s', '0.6s'),
  },
  {
    id: 'tile-b',
    gradient: 'tileBaseB',
    vents: `
      <g fill="none" stroke="#22262b" stroke-width="1.5" opacity="0.6">
        <line x1="135" y1="20" x2="175" y2="20"/>
        <line x1="135" y1="25" x2="175" y2="25"/>
        <line x1="135" y1="30" x2="175" y2="30"/>
        <line x1="25" y1="165" x2="65" y2="165"/>
        <line x1="25" y1="170" x2="65" y2="170"/>
        <line x1="25" y1="175" x2="65" y2="175"/>
      </g>
    `,
    pulses: (id) => pulse(id, 'wire-2', '2.8s', '0.2s') + pulse(id, 'wire-3', '2s', '1s'),
  },
  {
    id: 'tile-c',
    gradient: 'tileBaseC',
    vents: `
      <g fill="none" stroke="#22262b" stroke-width="1.5" opacity="0.6">
        <line x1="10" y1="95" x2="50" y2="95"/>
        <line x1="10" y1="100" x2="50" y2="100"/>
        <line x1="10" y1="105" x2="50" y2="105"/>
        <line x1="150" y1="95" x2="190" y2="95"/>
        <line x1="150" y1="100" x2="190" y2="100"/>
        <line x1="150" y1="105" x2="190" y2="105"/>
      </g>
    `,
    pulses: (id) => pulse(id, 'wire-1', '2.4s', '0.3s') + pulse(id, 'wire-3', '3s', '0.9s'),
  },
];

function buildSymbol({ id, gradient, vents, pulses }) {
  const seamsAndWires = SHARED_SEAMS_AND_WIRES.replace(/\{ID\}/g, id);
  return `
    <symbol id="${id}" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="url(#${gradient})"/>
      ${vents}
      ${seamsAndWires}
      ${pulses(id)}
      ${SHARED_NODES}
    </symbol>
  `;
}

const TILE_MARKUP = `
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <linearGradient id="tileBaseA" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3d444d"/>
        <stop offset="50%" stop-color="#323840"/>
        <stop offset="100%" stop-color="#282d33"/>
      </linearGradient>
      <linearGradient id="tileBaseB" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3d4a4d"/>
        <stop offset="50%" stop-color="#323e40"/>
        <stop offset="100%" stop-color="#282f33"/>
      </linearGradient>
      <linearGradient id="tileBaseC" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#443d44"/>
        <stop offset="50%" stop-color="#383240"/>
        <stop offset="100%" stop-color="#2d2833"/>
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

      ${VARIANTS.map(buildSymbol).join('')}
    </defs>

    <g id="tile-grid"></g>
  </svg>
`;

export function initBackground() {
  const container = document.querySelector('#background-fx');
  container.innerHTML = TILE_MARKUP;
  const grid = container.querySelector('#tile-grid');

  function pickVariant(excluded) {
    const options = TILE_VARIANT_IDS.filter((id) => !excluded.includes(id));
    return options[Math.floor(Math.random() * options.length)];
  }

  function buildGrid() {
    const size = Math.round(window.innerWidth / 2);
    const cols = Math.ceil(window.innerWidth / size);
    const rows = Math.ceil(window.innerHeight / size);

    grid.innerHTML = '';
    const placedVariants = [];
    for (let row = 0; row < rows; row += 1) {
      placedVariants[row] = [];
      for (let col = 0; col < cols; col += 1) {
        // Never repeat the tile directly to the left or above, so
        // neighboring tiles are always visibly different from each other.
        const excluded = [];
        if (col > 0) excluded.push(placedVariants[row][col - 1]);
        if (row > 0) excluded.push(placedVariants[row - 1][col]);
        const variantId = pickVariant(excluded);
        placedVariants[row][col] = variantId;

        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `#${variantId}`);
        use.setAttribute('xlink:href', `#${variantId}`);
        use.setAttribute('x', col * size);
        use.setAttribute('y', row * size);
        use.setAttribute('width', size);
        use.setAttribute('height', size);
        grid.appendChild(use);
      }
    }
  }

  buildGrid();
  window.addEventListener('resize', buildGrid);
}
