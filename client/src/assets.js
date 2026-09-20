// Central list of media assets. preloadAssets() is called once when the
// app starts so sounds and images are already cached by the time any
// screen actually needs them, with no in-game delay.

const SOUND_PATHS = {
  error: '/sounds/error.wav',
  beep: '/sounds/beep.mp3',
  success: '/sounds/success.mp3',
};

const IMAGE_PATHS = {
  keypadButton: '/images/keypad-button.svg',
  popupError: '/images/popup-panel-red.svg',
  popupSuccess: '/images/popup-panel-green.svg',
};

export const sounds = {};
export const images = {};

export function preloadAssets() {
  Object.entries(SOUND_PATHS).forEach(([key, src]) => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    sounds[key] = audio;
  });

  Object.entries(IMAGE_PATHS).forEach(([key, src]) => {
    const image = new Image();
    image.src = src;
    images[key] = image;
  });
}
