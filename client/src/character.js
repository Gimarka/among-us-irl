// The player's character. The suit colour is driven by the --suit-color
// custom property on the surrounding frame, and the selfie is drawn inside
// the visor, clipped to its exact shape.
//
// The body/head artwork is traced from a supplied illustration (a pair of
// flexed, muscular arms framing an oval face) rather than hand-drawn like
// the rest of this file - hence the odd coordinate scale: it's defined in
// the original trace's units (roughly 0-6000 x 0-3350) and mapped into
// this SVG's viewBox by BODY_TRANSFORM, the same way the source files
// themselves did with their own <g transform>.
//
// It's built from two separate traces of the same artwork, layered:
// BODY_FILL_PATH is a solid silhouette (arms + head, no visor hole) used
// as the recolourable fill, and the original line-art paths (thin closed
// outlines - fingers, muscle creases, the visor ring) are drawn on top of
// it in fixed black for the crisp ink detail. Line art alone only colours
// those thin lines and leaves the body hollow, which is why the fill
// needed its own separate, genuinely solid shape rather than just
// colouring the outline path directly.
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

// The viewBox is padded well beyond the artwork's own bounds on every side:
// extra headroom above (hats reach above the head) and extra margin left,
// right and below (the fists reach almost exactly to the traced art's own
// edges, which without this margin gets cropped hard against the frame -
// resize only, never crop, is the rule). Nothing about the traced
// coordinates themselves changes, only how much surrounding canvas this
// SVG shows.
const VIEW_BOX = '-5 -45 630 380';

// Maps the traced artwork's own coordinate space onto the viewBox above,
// exactly like the source SVGs' own <g transform="translate(0,335)
// scale(0.1,-0.1)"> did.
const BODY_TRANSFORM = 'translate(0,335) scale(0.1,-0.1)';

// The face sits inside the head/visor ring path's own hole - there's no
// separate helmet shape to cut a hole in, the ring is two opposite-wound
// subpaths (an outer outline and an inner oval) that already leave their
// centre transparent. This is that inner subpath alone (traced off the
// ring path directly, not approximated as a plain ellipse - the hole is
// closer to a stadium/pill shape than a true oval, so an ellipse fitted to
// its bounds left a visible gap all the way round), used as the selfie's
// clip so the photo fills the hole edge to edge.
const VISOR_HOLE_PATH = 'M3265 2825 c179 -38 326 -155 408 -325 25 -52 57 -138 71 -190 89 -329 106 -943 35 -1294 -69 -344 -253 -539 -552 -586 -94 -15 -268 -8 -352 15 -277 75 -446 296 -499 656 -37 248 -39 651 -6 914 54 417 174 654 384 755 45 21 113 45 151 54 91 19 271 20 360 1z';

// The hole's own bounding box (in viewBox units, derived from
// VISOR_HOLE_PATH the same way) - used to place the <image> before it gets
// clipped to the exact shape above.
const VISOR_BOX = { x: 234.7, y: 51.1, width: 147.6, height: 241.7 };

// The provided artwork has no separate "top of the head" to hang a hat off
// of the way the old rounder helmet did, so each hat (still drawn in its
// original 220x260, head-centred-at-(110,105) coordinate space) is
// remapped with this transform onto the new head's position and size,
// derived from the ratio of the new head's width to the old one's.
const HAT_TRANSFORM = 'translate(156.28,-20.37) scale(1.386)';

// Hats are drawn last so they sit in front of the head instead of tucked
// behind it.
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
    .map(
      (hat) =>
        `<g class="character-hat hidden" data-hat="${hat.id}" transform="${HAT_TRANSFORM}">${hat.markup}</g>`,
    )
    .join('');

  return `
    <svg class="character-svg" viewBox="${VIEW_BOX}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <linearGradient id="${id}-visorGlass" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#a3f3ff"/>
          <stop offset="100%" stop-color="#38b6ff"/>
        </linearGradient>

        <clipPath id="${id}-visorClip">
          <path transform="${BODY_TRANSFORM}" d="${VISOR_HOLE_PATH}"/>
        </clipPath>
      </defs>

      <!-- The solid, recolourable body fill (a genuinely filled silhouette,
           not the hollow line art below) - drawn first so the visor and
           the line art on top of it can each play their own part. -->
      <g class="character-suit" transform="${BODY_TRANSFORM}">
        <path d="M2845 3327 c-288 -95 -477 -319 -599 -710 -25 -78 -47 -155 -51 -170 -6 -31 -4 -30 -95 -46 -105 -19 -176 -49 -214 -91 -41 -46 -88 -183 -114 -331 l-16 -98 -64 -32 -63 -31 -41 37 c-83 76 -222 117 -320 97 -29 -6 -63 -14 -76 -18 -21 -6 -22 -5 -11 22 19 48 15 189 -10 287 -25 99 -20 159 22 258 39 95 35 92 92 63 42 -21 61 -25 117 -22 52 2 70 -1 86 -15 43 -39 133 -47 198 -18 57 26 86 66 82 114 -2 30 2 41 17 49 66 35 110 103 101 158 -7 45 -54 151 -108 244 -33 56 -48 71 -85 88 -54 24 -80 22 -313 -23 -299 -58 -389 -90 -463 -167 -19 -20 -65 -89 -102 -152 -74 -128 -132 -208 -260 -355 -221 -254 -295 -376 -322 -533 -13 -73 -13 -100 -2 -172 7 -47 11 -103 9 -125 -2 -22 -4 -74 -4 -116 -1 -68 2 -81 29 -125 38 -60 110 -116 190 -145 45 -17 79 -40 136 -94 166 -158 387 -269 604 -306 134 -22 319 -11 450 26 17 5 24 -5 49 -72 65 -178 146 -311 262 -433 l73 -76 28 -147 28 -147 1012 0 c955 0 1012 1 1017 18 3 9 15 73 27 142 l22 125 66 70 c119 125 210 272 272 440 18 50 33 91 35 93 1 2 35 -6 75 -16 333 -88 738 26 1006 281 43 41 89 78 103 82 56 17 144 71 180 112 65 74 85 169 57 264 -10 33 -11 52 -4 70 6 13 11 83 11 154 0 116 -3 138 -27 204 -39 108 -103 210 -224 360 -170 209 -231 291 -276 369 -23 40 -58 101 -78 135 -68 117 -155 162 -431 221 -309 66 -343 68 -404 14 -57 -50 -154 -258 -154 -329 0 -43 33 -96 77 -124 28 -17 32 -26 33 -63 0 -27 8 -55 20 -72 48 -68 198 -81 262 -23 12 11 40 16 90 17 59 1 79 5 105 24 17 12 35 22 41 22 13 0 50 -88 69 -167 14 -56 15 -74 4 -122 -7 -31 -19 -87 -27 -126 -15 -68 -14 -166 2 -224 6 -21 5 -23 -12 -17 -125 52 -293 21 -407 -76 l-49 -41 -36 20 c-21 12 -54 26 -74 33 -32 10 -38 16 -38 40 0 37 -27 168 -52 255 -27 94 -51 139 -90 169 -36 26 -147 63 -225 74 -47 7 -48 8 -61 52 -73 248 -142 412 -221 529 -101 149 -237 260 -393 322 -83 33 -84 33 -278 36 -181 3 -200 1 -265 -20z"/>
      </g>

      <!-- Glass visor, shown until there is a selfie to put behind it. -->
      <path id="${id}-visor-base" transform="${BODY_TRANSFORM}" d="${VISOR_HOLE_PATH}" fill="url(#${id}-visorGlass)"/>

      <!-- The selfie itself, boxed to the visor's bounds and clipped to its
           exact shape so it fills the hole edge to edge. -->
      <image id="${id}-visor-photo" class="hidden"
             x="${VISOR_BOX.x}" y="${VISOR_BOX.y}" width="${VISOR_BOX.width}" height="${VISOR_BOX.height}"
             preserveAspectRatio="xMidYMid slice"
             clip-path="url(#${id}-visorClip)"/>

      <!-- The crisp black line art, drawn last (on top of the fill, the
           visor and the photo): the arms' outline/muscle detail, the
           visor ring's own frame (its hole here is what lets the photo
           show through at all), and the shading creases - always dark,
           regardless of suit colour, like the hats' own fixed strokes. -->
      <g fill="#101419" transform="${BODY_TRANSFORM}">
        <path d="M2830 3331 c-228 -73 -411 -249 -535 -515 -43 -91 -135 -350 -135 -379 0 -9 -28 -19 -87 -31 -217 -43 -258 -92 -314 -374 -11 -59 -23 -116 -25 -127 -2 -13 -22 -28 -55 -42 l-51 -23 -42 35 c-106 87 -232 116 -377 89 l-25 -5 7 61 c4 34 3 91 -2 128 -27 196 -23 261 23 370 l18 44 36 -23 c25 -15 58 -23 107 -27 43 -3 88 -13 111 -25 53 -26 148 -28 199 -3 48 23 78 66 81 114 2 30 12 47 53 87 67 66 75 104 44 195 -43 123 -99 227 -138 257 -35 27 -42 28 -137 27 -70 0 -153 -10 -268 -32 -213 -41 -280 -62 -355 -111 -68 -44 -98 -81 -180 -221 -66 -111 -133 -204 -241 -332 -179 -213 -264 -349 -299 -479 -19 -75 -22 -243 -4 -306 9 -32 9 -53 0 -88 -31 -123 17 -237 131 -314 34 -22 69 -41 77 -41 7 0 54 -38 103 -84 194 -184 385 -286 629 -336 118 -24 297 -27 386 -5 33 7 62 11 65 7 3 -4 12 -25 19 -47 48 -147 181 -368 294 -491 l66 -70 22 -107 22 -107 48 0 47 0 -14 72 c-29 153 -40 177 -120 261 -82 85 -139 168 -203 293 -39 78 -91 205 -91 224 0 9 139 94 145 88 2 -1 17 -39 34 -84 63 -162 214 -350 329 -408 65 -32 142 -56 210 -66 91 -12 90 0 -1 35 -144 54 -244 129 -336 254 -69 93 -113 188 -175 370 -54 157 -87 234 -106 246 -14 9 -13 -12 9 -145 10 -63 17 -117 15 -119 -7 -8 -90 21 -183 65 -52 24 -96 42 -99 40 -9 -10 76 -87 131 -120 l58 -34 -23 -16 c-13 -9 -59 -29 -103 -43 -74 -25 -93 -27 -240 -27 -132 0 -173 4 -237 22 -176 48 -308 115 -445 225 l-78 62 90 6 c85 6 170 24 188 39 4 4 -45 10 -110 13 -253 14 -408 81 -457 199 -22 52 -20 76 18 229 38 150 91 295 137 376 17 30 29 56 26 59 -17 18 -124 -158 -185 -306 -9 -21 -11 -12 -11 48 -1 115 50 247 148 382 14 19 82 105 151 190 141 174 180 226 235 320 99 168 134 205 231 243 60 23 385 87 481 94 76 5 82 4 105 -18 27 -27 107 -202 115 -252 3 -23 -1 -39 -15 -57 l-20 -24 -12 59 c-15 71 -48 165 -59 165 -17 0 -17 -14 0 -103 28 -143 23 -187 -22 -187 -13 0 -17 14 -22 68 -6 64 -31 157 -47 176 -21 22 -26 -8 -14 -71 19 -99 18 -199 -2 -207 -37 -14 -44 -7 -44 47 0 85 -43 207 -65 185 -4 -3 -2 -32 4 -64 6 -32 11 -88 11 -126 0 -64 -2 -69 -26 -78 -39 -15 -117 -12 -142 6 -29 20 -42 54 -30 77 10 20 31 22 58 5 29 -18 32 -6 9 40 -19 38 -39 55 -39 34 0 -5 -17 -16 -38 -24 -31 -12 -40 -22 -45 -47 -6 -28 -10 -31 -45 -31 -47 0 -97 31 -130 80 -13 19 -27 37 -33 38 -15 6 -10 -37 11 -87 l21 -48 -45 -72 c-45 -73 -110 -234 -103 -255 2 -6 16 12 32 39 84 149 157 255 173 255 4 0 13 -4 21 -9 12 -7 10 -20 -12 -74 -44 -110 -52 -181 -32 -292 26 -145 18 -260 -25 -350 -44 -93 -126 -174 -220 -219 -80 -38 -78 -52 5 -37 109 20 211 91 273 188 30 48 48 58 129 73 114 20 244 -29 329 -124 46 -51 133 -191 134 -213 0 -7 5 -13 10 -13 18 0 11 70 -15 146 -14 41 -25 76 -25 79 0 3 19 14 43 27 112 58 334 22 456 -73 13 -11 28 -19 33 -19 16 0 -36 82 -68 106 l-31 24 23 113 c173 852 353 1181 709 1303 106 36 293 45 412 19 155 -33 303 -124 406 -250 152 -183 241 -419 352 -930 l54 -250 -38 -40 c-40 -42 -66 -83 -58 -92 3 -3 25 8 49 25 24 16 75 42 113 58 63 26 82 29 180 29 112 0 205 -22 205 -48 0 -6 -11 -38 -24 -71 -27 -70 -42 -156 -27 -156 5 0 27 33 48 73 45 86 166 213 233 245 67 32 138 43 207 32 85 -14 110 -27 137 -75 59 -100 175 -175 295 -191 60 -8 68 6 14 25 -100 36 -202 129 -248 226 -51 108 -56 195 -24 362 23 121 19 167 -26 292 -13 36 -23 66 -22 67 1 1 12 4 24 8 18 6 29 -5 76 -76 30 -46 72 -113 92 -150 20 -38 39 -68 42 -68 23 0 -51 183 -114 284 l-31 49 24 45 c25 46 31 87 15 97 -5 3 -20 -14 -33 -37 -13 -23 -38 -53 -57 -65 -42 -29 -109 -32 -117 -5 -11 34 -21 47 -50 61 -16 8 -32 18 -35 23 -7 11 -20 -5 -44 -51 l-17 -34 24 7 c51 16 63 13 66 -20 5 -47 -34 -74 -107 -74 -86 0 -95 10 -88 106 3 43 9 100 13 127 4 30 3 47 -4 47 -17 0 -51 -102 -58 -175 -4 -36 -10 -68 -14 -70 -5 -3 -18 3 -31 14 -23 18 -23 19 -9 112 22 158 23 169 11 169 -18 0 -41 -65 -59 -160 -8 -47 -16 -87 -18 -88 -1 -2 -12 -1 -23 3 -18 5 -21 14 -21 58 1 29 7 81 15 117 17 76 19 110 6 110 -13 0 -52 -98 -65 -162 -11 -61 -16 -67 -36 -43 -20 24 -6 92 40 195 56 124 70 140 131 140 110 0 468 -78 556 -121 71 -34 92 -58 158 -179 64 -115 141 -229 232 -342 125 -154 183 -236 229 -321 53 -100 74 -179 74 -272 l-1 -70 -24 63 c-45 117 -146 285 -161 269 -2 -2 16 -46 40 -98 45 -94 116 -326 137 -443 15 -90 0 -138 -61 -197 -76 -75 -207 -114 -420 -128 l-115 -7 55 -18 c30 -10 95 -20 143 -23 87 -6 87 -6 70 -26 -41 -46 -184 -142 -287 -192 -168 -82 -247 -100 -441 -100 -172 0 -226 10 -329 62 l-49 25 64 38 c64 38 137 105 127 115 -3 3 -47 -15 -99 -39 -93 -44 -175 -73 -183 -65 -2 2 5 54 15 114 11 61 18 121 17 135 -5 45 -55 -55 -113 -229 -60 -182 -106 -277 -175 -371 -94 -126 -198 -205 -337 -256 l-78 -29 42 -3 c54 -4 150 21 232 61 130 63 281 247 347 421 15 39 28 72 29 74 2 2 129 -63 144 -74 7 -6 -34 -114 -80 -209 -64 -134 -116 -210 -210 -310 -86 -90 -96 -110 -128 -257 l-19 -88 47 0 48 0 23 107 23 108 73 78 c116 123 225 302 284 465 13 34 26 65 30 67 4 2 22 0 41 -5 19 -6 76 -15 127 -21 174 -19 370 19 561 111 138 67 224 126 334 230 60 56 112 96 149 112 72 33 140 96 169 156 18 38 22 61 20 122 -4 114 -4 145 4 275 9 142 -3 204 -64 330 -47 97 -104 178 -245 350 -134 164 -192 246 -250 362 -94 184 -190 233 -599 303 -202 34 -266 25 -324 -44 -37 -45 -114 -230 -120 -289 -7 -57 17 -108 68 -149 32 -25 39 -38 39 -66 0 -51 28 -90 88 -119 44 -21 62 -25 106 -20 30 3 69 13 87 23 19 10 67 21 107 24 53 5 81 13 103 29 17 13 32 21 34 19 1 -1 15 -40 29 -86 30 -97 32 -135 10 -250 -10 -52 -15 -121 -12 -174 3 -85 2 -89 -17 -84 -101 24 -191 14 -290 -33 -34 -15 -77 -43 -98 -60 l-37 -33 -62 25 c-61 25 -63 27 -71 69 -54 280 -73 336 -131 393 -44 43 -100 65 -219 86 -67 12 -67 12 -78 53 -6 23 -26 88 -45 145 -124 375 -332 618 -611 716 -69 24 -84 25 -275 24 -165 0 -213 -3 -258 -18z m-1162 -753 c-19 -29 -60 -42 -106 -33 l-37 7 60 23 c33 13 68 24 79 24 17 1 17 -1 4 -21z m2971 -1 c65 -25 70 -37 14 -37 -41 0 -93 25 -93 45 0 20 7 19 79 -8z m-428 -278 c56 -22 78 -60 108 -181 16 -63 32 -138 36 -165 l7 -50 -79 -6 c-43 -3 -90 -9 -104 -12 l-25 -7 -33 159 c-18 87 -39 180 -47 207 -8 27 -14 60 -14 72 0 22 0 22 63 8 34 -8 74 -19 88 -25z m-2081 23 c0 -4 -9 -40 -20 -80 -11 -40 -34 -137 -51 -215 -16 -77 -31 -143 -33 -145 -2 -2 -21 1 -43 7 -21 6 -64 11 -96 11 l-59 0 7 53 c4 28 20 104 36 167 35 138 54 163 150 190 69 20 109 24 109 12z"/>
        <path d="M2924 2915 c-235 -42 -402 -163 -504 -365 -38 -75 -95 -263 -119 -390 -38 -205 -45 -299 -45 -595 0 -421 31 -610 136 -825 44 -91 62 -117 137 -191 98 -98 196 -153 336 -190 113 -30 335 -30 450 0 210 55 369 180 458 361 75 154 116 326 137 575 28 347 -7 787 -85 1060 -35 126 -112 277 -177 349 -160 179 -445 262 -724 211z m341 -90 c179 -38 326 -155 408 -325 25 -52 57 -138 71 -190 89 -329 106 -943 35 -1294 -69 -344 -253 -539 -552 -586 -94 -15 -268 -8 -352 15 -277 75 -446 296 -499 656 -37 248 -39 651 -6 914 54 417 174 654 384 755 45 21 113 45 151 54 91 19 271 20 360 1z"/>
        <path d="M1025 1535 c19 -90 130 -212 243 -267 63 -31 74 -33 172 -33 99 0 110 2 171 32 105 52 135 101 43 69 -26 -9 -84 -21 -128 -28 -173 -25 -328 45 -470 212 -37 44 -37 44 -31 15z"/>
        <path d="M5095 1475 c-133 -135 -270 -188 -428 -165 -43 6 -96 18 -119 26 -22 8 -47 14 -56 14 -29 0 29 -49 97 -83 61 -30 73 -32 166 -32 93 0 105 3 168 33 87 43 184 134 226 212 18 33 31 64 29 68 -2 5 -39 -28 -83 -73z"/>
        <path d="M4071 419 c-13 -17 -59 -71 -103 -120 -44 -49 -75 -89 -70 -89 20 0 131 81 156 115 27 35 56 95 56 115 0 19 -16 10 -39 -21z"/>
        <path d="M2113 388 c8 -51 32 -85 100 -135 84 -61 101 -55 36 15 -30 31 -74 80 -98 107 l-43 50 5 -37z"/>
      </g>

      <!-- Hats drawn last so they sit in front of the head -->
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
