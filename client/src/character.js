// The player's character. The suit colour is driven by the --suit-color
// custom property on the surrounding frame, and the selfie is drawn inside
// the visor, clipped to its circle.
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

const VISOR = 'cx="110" cy="85" rx="36" ry="50"';

export function characterMarkup(id) {
  return `
    <svg class="character-svg" viewBox="0 0 220 240" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
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
            d="M 25 230 C 25 180, 55 150, 80 145 L 80 130 L 140 130 L 140 145 C 165 150, 195 180, 195 230 Z"
            stroke="#101419" stroke-width="8" stroke-linejoin="round"/>

      <!-- Suit collar -->
      <path d="M 75 145 C 75 160, 145 160, 145 145" fill="none" stroke="#101419" stroke-width="8" stroke-linecap="round"/>

      <!-- Helmet -->
      <path class="character-suit"
            d="M 50 85 C 50 25, 170 25, 170 85 C 170 130, 145 145, 110 145 C 75 145, 50 130, 50 85 Z"
            stroke="#101419" stroke-width="8" stroke-linejoin="round"/>

      <!-- Glass visor, shown until there is a selfie to put behind it -->
      <ellipse id="${id}-visor-base" ${VISOR} fill="url(#${id}-visorGlass)"/>

      <!-- The selfie itself, boxed to the visor's bounds -->
      <image id="${id}-visor-photo" class="hidden" x="74" y="35" width="72" height="100"
             preserveAspectRatio="xMidYMid slice"
             clip-path="url(#${id}-visorClip)"/>

      <!-- Visor ring and glare drawn last so they sit over the photo -->
      <ellipse ${VISOR} fill="none" stroke="#101419" stroke-width="8"/>
      <ellipse class="visor-glare" cx="98" cy="62" rx="12" ry="8" fill="#ffffff" opacity="0.85" transform="rotate(-15 98 62)"/>
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

export function setSuitColor(frame, color) {
  frame.style.setProperty('--suit-color', color);
}
