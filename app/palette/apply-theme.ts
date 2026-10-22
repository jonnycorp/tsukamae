import { FADE_MS } from '../hooks/use-dismissable';
import { DEFAULT_THEME, findTheme, themePalette, themeSlug } from './themes';

export const THEME_STORAGE_KEY = 'theme';
export const SOFT_DARK_STORAGE_KEY = 'nightMode';
// the palette menu's display switches: the first two on by default, types on the tiles off
export const LOCATION_TINTS_STORAGE_KEY = 'locationTints';
export const FLIP_TYPES_STORAGE_KEY = 'flipTypes';
export const TILE_TYPES_STORAGE_KEY = 'tileTypes';
export const STILL_STORAGE_KEY = 'stillMode';

// the modal backdrop's black, rgba(0, 0, 0, .35) in styles/main.scss
const MODAL_SHADE = 0.35;

let titleBar = { color: '', symbolColor: '' };
// the backdrops up, each its own black; the buttons take the darkest
const openShades: number[] = [];
// how much of the backdrop's black is on the buttons: it fades in and out with the backdrop
let shade = 0;
let shadeFrame = 0;

// #rrggbb under black at `alpha`; anything else is passed through
function shaded (color: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match || alpha === 0) {
    return color;
  }
  const channels = [0, 2, 4].map((i) => Math.round(parseInt(match[1].slice(i, i + 2), 16) * (1 - alpha)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

// the desktop window buttons sit on the nav (or a scene's bar, in the nav's colours), drawn by the system, so they take
// its colours, and its dimming under a modal
function sendTitleBar () {
  window.tracker?.setTitleBarColors({ color: shaded(titleBar.color, shade), symbolColor: shaded(titleBar.symbolColor, shade) });
}

// frame by frame alongside the backdrop's fade (ease-out, as in the CSS), starting from wherever the last fade left it;
// a backdrop lighter than a modal's (the palette's) gives its own
export function dimTitleBar (dim: boolean, amount = MODAL_SHADE) {
  if (dim) {
    openShades.push(amount);
  } else if (openShades.includes(amount)) {
    openShades.splice(openShades.indexOf(amount), 1);
  }
  const from = shade;
  const to = Math.max(0, ...openShades);
  const start = performance.now();
  cancelAnimationFrame(shadeFrame);
  const step = (now: number) => {
    const t = Math.min(1, Math.max(0, (now - start) / FADE_MS));
    shade = from + (to - from) * (1 - (1 - t) ** 2);
    sendTitleBar();
    if (t < 1) {
      shadeFrame = requestAnimationFrame(step);
    }
  };
  shadeFrame = requestAnimationFrame(step);
}

function setTokens (name: string, softDark: boolean) {
  const root = document.documentElement;
  const seed = findTheme(name);
  const palette = themePalette(seed, softDark ? 'dark' : 'light');
  for (const [token, value] of Object.entries(palette)) {
    root.style.setProperty(`--${token}`, value);
  }
  root.classList.toggle('soft-dark', softDark);
  // a theme's character beyond its colours keys on these (styles/themes.scss)
  root.dataset.theme = themeSlug(seed.name);
  root.dataset.mode = softDark ? 'dark' : 'light';
  titleBar = { color: palette.chrome, symbolColor: palette['on-chrome'] };
}

// the browser repaints the buttons at once, while the page takes a frame or more to restyle for a new theme: sent with
// the change, the buttons flipped that far ahead of the nav, so they're sent once the page has rendered it
export function applyTheme (name: string, softDark: boolean) {
  setTokens(name, softDark);
  requestAnimationFrame(() => setTimeout(sendTitleBar));
}

// attributes on the root for styles/tracker.scss and useFlipClock to read, so switching any of them restyles the dex
// without rendering a tile: with location tints off every sealed tile takes a game's wash; with types out of the flips
// the cycle swings between the record's face and the trainer's; with types on the tiles each unsealed tile shows its
// types' glyphs at its foot (styles/tile-types.scss); in still mode nothing moves (the boxes' shine, the meter's water;
// useFlipClock holds the flips), the sealed look staying as it is
export function applyDisplay (locationTints: boolean, flipTypes: boolean, tileTypes = false, still = false) {
  const root = document.documentElement;
  root.toggleAttribute('data-plain-seals', !locationTints);
  root.toggleAttribute('data-flip-no-types', !flipTypes);
  root.toggleAttribute('data-tile-types', tileTypes);
  root.toggleAttribute('data-still', still);
}

function readJson<T> (key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// runs before the first render so launch never paints without its tokens; the window stays hidden until that first
// paint, so the buttons take their colours straight away
export function bootstrapTheme () {
  setTokens(readJson(THEME_STORAGE_KEY, DEFAULT_THEME), readJson(SOFT_DARK_STORAGE_KEY, false));
  applyDisplay(readJson(LOCATION_TINTS_STORAGE_KEY, true), readJson(FLIP_TYPES_STORAGE_KEY, true), readJson(TILE_TYPES_STORAGE_KEY, false), readJson(STILL_STORAGE_KEY, false));
  sendTitleBar();
}
