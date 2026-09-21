// The player's character. The selfie is drawn inside the visor, clipped to
// the visor's pill shape, so a square photo gets centre-cropped to the
// visor's wider-than-tall shape (the same idea as object-fit: cover).
//
// Every gradient/clip id is prefixed because the markup is used more than
// once on the page, and duplicate ids would make one instance reference
// another's definitions.
const VISOR = 'x="82" y="68" width="64" height="46" rx="23"';

// The same visor on its own, in a viewBox cropped to it with 3 units of
// room for the stroke that straddles its edge.
const LONE_VISOR = 'x="3" y="3" width="64" height="46" rx="23"';

function visorGlass(id) {
  return `
    <linearGradient id="${id}-metalVisor" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#a6e3e9"/>
      <stop offset="100%" stop-color="#3b6978"/>
    </linearGradient>
  `;
}

// Just the visor, used while the player is taking their selfie.
export function visorMarkup(id) {
  return `
    <svg class="character-svg" viewBox="0 0 70 52" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        ${visorGlass(id)}
        <clipPath id="${id}-visorClip">
          <rect ${LONE_VISOR}/>
        </clipPath>
      </defs>

      <rect id="${id}-visor-base" class="character-fill" ${LONE_VISOR} fill="url(#${id}-metalVisor)"/>

      <image id="${id}-visor-photo" class="hidden" ${LONE_VISOR}
             preserveAspectRatio="xMidYMid slice"
             clip-path="url(#${id}-visorClip)"/>

      <!-- Thinner than the character's 6, since this viewBox is blown up
           roughly 3x on screen and would otherwise render very chunky. -->
      <rect ${LONE_VISOR} fill="none" stroke="#06101e" stroke-width="2.5"/>
      <ellipse class="visor-glare" cx="27" cy="15" rx="16" ry="6" fill="#ffffff" opacity="0.5" transform="rotate(-12, 27, 15)"/>
    </svg>
  `;
}

export function characterMarkup(id) {
  return `
    <svg class="character-svg" viewBox="0 0 200 240" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="${id}-metalBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00e5ff"/>
          <stop offset="50%" stop-color="#0088cc"/>
          <stop offset="100%" stop-color="#003366"/>
        </linearGradient>

        ${visorGlass(id)}

        <clipPath id="${id}-visorClip">
          <rect ${VISOR}/>
        </clipPath>
      </defs>

      <!-- Backpack -->
      <path class="character-fill" d="M 32 85 C 20 85, 20 160, 32 160 L 55 160 L 55 85 Z" fill="#005580" stroke="#06101e" stroke-width="6"/>

      <!-- Main Body -->
      <path class="character-fill"
            d="M 60 180 L 60 195 C 60 210, 85 210, 85 195 L 85 165 L 115 165 L 115 195 C 115 210, 140 210, 140 195 L 140 140 C 155 125, 155 55, 100 40 C 45 40, 45 125, 60 180 Z"
            fill="url(#${id}-metalBody)"
            stroke="#06101e"
            stroke-width="6"
            stroke-linejoin="round"/>

      <!-- Glass visor, shown until there is something to put behind it -->
      <rect id="${id}-visor-base" class="character-fill" ${VISOR} fill="url(#${id}-metalVisor)"/>

      <!-- The selfie itself -->
      <image id="${id}-visor-photo" class="hidden" ${VISOR}
             preserveAspectRatio="xMidYMid slice"
             clip-path="url(#${id}-visorClip)"/>

      <!-- Outline and glare drawn last so they sit over the photo -->
      <rect ${VISOR} fill="none" stroke="#06101e" stroke-width="6"/>
      <ellipse cx="106" cy="80" rx="16" ry="6" fill="#ffffff" opacity="0.5" transform="rotate(-12, 106, 80)"/>
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
