import { DISPLAY_MODES } from '../utils/display-modes';
import { FADE_MS } from '../hooks/use-dismissable';
import { DEFAULT_THEME, findTheme, themePalette, themeSide, themeSlug } from './themes';
import { whenSettled } from '../utils/when-settled';

import type { DisplayMode } from '../utils/display-modes';

export const THEME_STORAGE_KEY = 'theme';
// the palette menu's display switches: location tints on by default, still mode off, and the sealed tiles' display
// mode (utils/display-modes), Hexagon by default
export const LOCATION_TINTS_STORAGE_KEY = 'locationTints';
export const STILL_STORAGE_KEY = 'stillMode';
// the themes' own typefaces for headings and figures (styles/themes.scss), on by default
export const TYPEFACES_STORAGE_KEY = 'themeTypefaces';
export const DISPLAY_STORAGE_KEY = 'tileDisplay';

// the modal backdrop's black, rgba(0, 0, 0, .35) in styles/main.scss
const MODAL_SHADE = 0.35;

let titleBar = { color: '', symbolColor: '' };
// the backdrops up; the buttons dim while any is
let openBackdrops = 0;
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

// #rrggbb with no alpha, as rgba(); anything else is passed through
function clear (color: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) {
    return color;
  }
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, 0)`;
}

// the desktop window buttons sit on the nav (or a scene's bar, in the nav's colours), drawn by the system. Their glyphs
// take its colours, and its dimming under a modal; their ground is its colour with no alpha, so the bar itself shows
// under them, whatever a theme draws on it (waves, a rope, a hinge, an edge), and the backdrop dims it there as it dims
// the bar, while their hover and press still take a tint that suits the bar's colour
function sendTitleBar () {
  window.tracker?.setTitleBarColors({ color: clear(shaded(titleBar.color, shade)), symbolColor: shaded(titleBar.symbolColor, shade) });
}

// frame by frame alongside the backdrop's fade (ease-out, as in the CSS), starting from wherever the last fade left it;
// at once in still mode, as the backdrop is
export function dimTitleBar (dim: boolean) {
  openBackdrops = Math.max(0, openBackdrops + (dim ? 1 : -1));
  const from = shade;
  const to = openBackdrops > 0 ? MODAL_SHADE : 0;
  cancelAnimationFrame(shadeFrame);
  if (document.documentElement.hasAttribute('data-still')) {
    shade = to;
    sendTitleBar();
    return;
  }
  const start = performance.now();
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

function setTokens (name: string) {
  const root = document.documentElement;
  const seed = findTheme(name);
  const side = themeSide(seed);
  const palette = themePalette(seed, side);
  for (const [token, value] of Object.entries(palette)) {
    root.style.setProperty(`--${token}`, value);
  }
  // a theme's character beyond its colours keys on these (styles/themes.scss)
  root.dataset.theme = themeSlug(seed.name);
  root.dataset.mode = side;
  root.dataset.pageChange = seed.pageChange ?? 'slide';
  titleBar = { color: palette.chrome, symbolColor: palette['on-chrome'] };
}

// the browser repaints the buttons at once, while the page takes a frame or more to restyle for a new theme: sent with
// the change, the buttons flipped that far ahead of the nav, so they're sent once the page has rendered it
export function applyTheme (name: string) {
  setTokens(name);
  requestAnimationFrame(() => setTimeout(sendTitleBar));
}

// attributes on the root for the styles to read, so switching any of them restyles the dex without rendering a tile:
// with location tints off every sealed tile takes a game's wash; in still mode nothing moves (the meter's water;
// useFlipClock holds the flips), the sealed look staying as it is. The display mode picks the flips'
// cycle for its pages (styles/tile-faces.scss), the pages FlipStrips draws
export function applyDisplay (locationTints: boolean, still: boolean, display: DisplayMode, typefaces: boolean) {
  const root = document.documentElement;
  root.toggleAttribute('data-typefaces', typefaces);
  root.toggleAttribute('data-plain-seals', !locationTints);
  root.toggleAttribute('data-still', still);
  root.dataset.display = display;
}

// keep in sync with styles/tile-faces.scss: the flips' fade out before a display mode's switch
const DISPLAY_FADE_MS = 140;
// the switch waiting out of sight, the latest asked for
let displaySwitch: (() => void) | null = null;
let displayFading = false;

// a display mode's switch, faded (the theme menu, O): the dex's flips fade out (data-display-fade), the mode
// changes out of sight, and they fade back in once the dex has redrawn them and stopped building, by when every strip's
// cycle has caught up with the clock, so the page one restarts on never shows. At once in still mode, or with no flips
// on the page (no dex open, the list view, a checklist); one asked for while another is under way follows it unseen
export function fadeDisplay (apply: () => void) {
  const root = document.documentElement;
  const dex = document.querySelector('.dex-column');
  if (!displayFading && (root.hasAttribute('data-still') || !dex?.querySelector('.flip-overlay'))) {
    apply();
    return;
  }
  displaySwitch = apply;
  if (displayFading) {
    return;
  }
  displayFading = true;
  root.toggleAttribute('data-display-fade', true);
  const next = () => {
    const run = displaySwitch;
    displaySwitch = null;
    if (!run) {
      root.removeAttribute('data-display-fade');
      displayFading = false;
      return;
    }
    run();
    void whenSettled(dex!).then(next);
  };
  window.setTimeout(next, DISPLAY_FADE_MS);
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
  setTokens(readJson(THEME_STORAGE_KEY, DEFAULT_THEME));
  const display = readJson<DisplayMode>(DISPLAY_STORAGE_KEY, 'hexagon');
  applyDisplay(readJson(LOCATION_TINTS_STORAGE_KEY, true), readJson(STILL_STORAGE_KEY, false), DISPLAY_MODES.includes(display) ? display : 'hexagon', readJson(TYPEFACES_STORAGE_KEY, true));
  sendTitleBar();
}
