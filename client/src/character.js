// The player's character. The suit colour is driven by the --suit-color
// custom property on the surrounding frame, and the selfie is drawn inside
// the visor, clipped to its oval.
//
// Every gradient/clip id is prefixed because the markup is used more than
// once on the page, and duplicate ids would make one instance reference
// another's definitions.

// The classic Among Us palette.
export const SUIT_COLORS = [
  '#c51111', // red
  '#132ed1', // blue
  '#117f2d', // green
  '#ed54ba', // pink
  '#ef7d0d', // orange
  '#f5f557', // yellow
  '#3f474e', // black
  '#d6e0f0', // white
  '#6b2fbb', // purple
  '#71491e', // brown
  '#38fedc', // cyan
  '#50ef39', // lime
];

export const DEFAULT_SUIT_COLOR = SUIT_COLORS[0];

const VISOR = 'cx="110" cy="105" rx="36" ry="50"';

// Hats are drawn before the character so their brims tuck behind the helmet.
export const HATS = [
  { id: 'none', markup: '' },
  {
    id: 'tophat',
    markup: `
      <path d="M 40 60 C 70 58, 150 58, 180 60 L 170 65 C 145 62, 75 62, 50 65 Z" fill="#101419" stroke="#101419" stroke-width="8" stroke-linejoin="round"/>
      <path d="M 70 60 L 75 10 L 145 10 L 150 60 Z" fill="#101419" stroke="#101419" stroke-width="8" stroke-linejoin="round"/>
      <path d="M 71 50 L 73 38 L 147 38 L 149 50 Z" fill="#d90429" stroke="#101419" stroke-width="6" stroke-linejoin="round"/>
      <ellipse cx="110" cy="60" rx="65" ry="10" fill="#212529" stroke="#101419" stroke-width="8"/>
    `,
  },
  {
    id: 'princess',
    markup: `
      <path d="M 110 5 C 140 5, 170 30, 160 80 C 145 65, 125 55, 110 50 Z" fill="#e0aaff" stroke="#101419" stroke-width="6" stroke-linejoin="round"/>
      <polygon points="110,5 75,55 145,55" fill="#ff70a6" stroke="#101419" stroke-width="8" stroke-linejoin="round"/>
      <path d="M 70 55 C 70 45, 150 45, 150 55 C 150 62, 70 62, 70 55 Z" fill="#ffffff" stroke="#101419" stroke-width="8" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'crown',
    markup: `
      <polygon points="65,55 60,20 85,38 110,12 135,38 160,20 155,55" fill="#ffb703" stroke="#101419" stroke-width="8" stroke-linejoin="round"/>
      <circle cx="110" cy="30" r="5" fill="#d90429" stroke="#101419" stroke-width="4"/>
      <circle cx="78" cy="38" r="4" fill="#3a86ff" stroke="#101419" stroke-width="3"/>
      <circle cx="142" cy="38" r="4" fill="#3a86ff" stroke="#101419" stroke-width="3"/>
      <path d="M 65 55 C 65 48, 155 48, 155 55 Z" fill="#fb8500" stroke="#101419" stroke-width="8" stroke-linejoin="round"/>
    `,
  },
  {
    id: 'viking',
    markup: `
      <path d="M 60 50 C 30 50, 20 20, 35 10 C 45 25, 55 35, 70 40 Z" fill="#f4f1de" stroke="#101419" stroke-width="8" stroke-linejoin="round"/>
      <path d="M 160 50 C 190 50, 200 20, 185 10 C 175 25, 165 35, 150 40 Z" fill="#f4f1de" stroke="#101419" stroke-width="8" stroke-linejoin="round"/>
      <path d="M 60 55 C 60 30, 160 30, 160 55 Z" fill="#6c757d" stroke="#101419" stroke-width="8" stroke-linejoin="round"/>
      <line x1="110" y1="30" x2="110" y2="55" stroke="#101419" stroke-width="8"/>
    `,
  },
];

export const DEFAULT_HAT = HATS[0].id;

export function characterMarkup(id) {
  const hats = HATS.filter((hat) => hat.markup)
    .map((hat) => `<g class="character-hat hidden" data-hat="${hat.id}">${hat.markup}</g>`)
    .join('');

  return `
    <svg class="character-svg" viewBox="0 0 220 260" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="${id}-visorGlass" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#a3f3ff"/>
          <stop offset="100%" stop-color="#38b6ff"/>
        </linearGradient>

        <clipPath id="${id}-visorClip">
          <ellipse ${VISOR}/>
        </clipPath>
      </defs>

      <!-- Bust / shoulders -->
      <path class="character-suit"
            d="M 25 250 C 25 200, 55 170, 80 165 L 80 150 L 140 150 L 140 165 C 165 170, 195 200, 195 250 Z"
            stroke="#101419" stroke-width="8" stroke-linejoin="round"/>

      <!-- Suit collar -->
      <path d="M 75 165 C 75 180, 145 180, 145 165" fill="none" stroke="#101419" stroke-width="8" stroke-linecap="round"/>

      <!-- Helmet -->
      <path class="character-suit"
            d="M 50 105 C 50 45, 170 45, 170 105 C 170 150, 145 165, 110 165 C 75 165, 50 150, 50 105 Z"
            stroke="#101419" stroke-width="8" stroke-linejoin="round"/>

      <!-- Glass visor, shown until there is a selfie to put behind it -->
      <ellipse id="${id}-visor-base" ${VISOR} fill="url(#${id}-visorGlass)"/>

      <!-- The selfie itself, boxed to the visor's bounds -->
      <image id="${id}-visor-photo" class="hidden" x="74" y="55" width="72" height="100"
             preserveAspectRatio="xMidYMid slice"
             clip-path="url(#${id}-visorClip)"/>

      <!-- Visor ring -->
      <ellipse ${VISOR} fill="none" stroke="#101419" stroke-width="8"/>

      <!-- Hats drawn last so they sit in front of the helmet and visor -->
      ${hats}
    </svg>
  `;
}

export function setVisorPhoto(id, photoDataUrl) {
  const photo = document.querySelector(`#${id}-visor-photo`);
  const base = document.querySelector(`#${id}-visor-base`);
  photo.setAttribute('href', photoDataUrl);
  photo.setAttribute('xlink:href', photoDataUrl);
  photo.classList.remove('hidden');
  base.classList.add('hidden');
}

// The reverse of setVisorPhoto: back to the plain glass visor. Needed for a
// character slot that gets reused for different players over time (the
// lobby), where a new occupant might not have taken a selfie.
export function clearVisorPhoto(id) {
  const photo = document.querySelector(`#${id}-visor-photo`);
  const base = document.querySelector(`#${id}-visor-base`);
  photo.classList.add('hidden');
  base.classList.remove('hidden');
}

export function setSuitColor(frame, color) {
  frame.style.setProperty('--suit-color', color);
}

export function setHat(frame, hatId) {
  frame.querySelectorAll('.character-hat').forEach((hat) => {
    hat.classList.toggle('hidden', hat.dataset.hat !== hatId);
  });
}
