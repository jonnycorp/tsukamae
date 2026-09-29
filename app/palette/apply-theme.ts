import { FADE_MS } from '../hooks/use-dismissable';
import { DEFAULT_THEME, findTheme, themePalette } from './themes';

export const THEME_STORAGE_KEY = 'theme';
export const SOFT_DARK_STORAGE_KEY = 'nightMode';

// the modal backdrop's black, rgba(0, 0, 0, .35) in styles/main.scss
const MODAL_SHADE = 0.35;

let titleBar = { color: '', symbolColor: '' };
let openModals = 0;
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

// the desktop window buttons sit on the nav, drawn by the system, so they take its colours, and its dimming under a modal
function sendTitleBar () {
  window.tracker?.setTitleBarColors({ color: shaded(titleBar.color, shade), symbolColor: shaded(titleBar.symbolColor, shade) });
}

// frame by frame alongside the backdrop's fade (ease-out, as in the CSS), starting from wherever the last fade left it
export function dimTitleBar (dim: boolean) {
  openModals = Math.max(0, openModals + (dim ? 1 : -1));
  const from = shade;
  const to = openModals > 0 ? MODAL_SHADE : 0;
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
  const palette = themePalette(findTheme(name), softDark ? 'dark' : 'light');
  for (const [token, value] of Object.entries(palette)) {
    root.style.setProperty(`--${token}`, value);
  }
  root.classList.toggle('soft-dark', softDark);
  titleBar = { color: palette.chrome, symbolColor: palette['on-chrome'] };
}

// the browser repaints the buttons at once, while the page takes a frame or more to restyle for a new theme: sent with
// the change, the buttons flipped that far ahead of the nav, so they're sent once the page has rendered it
export function applyTheme (name: string, softDark: boolean) {
  setTokens(name, softDark);
  requestAnimationFrame(() => setTimeout(sendTitleBar));
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
  sendTitleBar();
}
