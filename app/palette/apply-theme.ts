import { DEFAULT_THEME, findTheme, themePalette } from './themes';

export const THEME_STORAGE_KEY = 'theme';
export const SOFT_DARK_STORAGE_KEY = 'nightMode';

// the modal backdrop's black, rgba(0, 0, 0, .35) in styles/main.scss
const MODAL_SHADE = 0.35;

let titleBar = { color: '', symbolColor: '' };
let openModals = 0;

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
  const alpha = openModals > 0 ? MODAL_SHADE : 0;
  window.tracker?.setTitleBarColors({ color: shaded(titleBar.color, alpha), symbolColor: shaded(titleBar.symbolColor, alpha) });
}

export function dimTitleBar (dim: boolean) {
  openModals = Math.max(0, openModals + (dim ? 1 : -1));
  sendTitleBar();
}

export function applyTheme (name: string, softDark: boolean) {
  const root = document.documentElement;
  const palette = themePalette(findTheme(name), softDark ? 'dark' : 'light');
  for (const [token, value] of Object.entries(palette)) {
    root.style.setProperty(`--${token}`, value);
  }
  root.classList.toggle('soft-dark', softDark);
  titleBar = { color: palette.chrome, symbolColor: palette['on-chrome'] };
  sendTitleBar();
}

function readJson<T> (key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// runs before the first render so launch never paints without its tokens
export function bootstrapTheme () {
  applyTheme(readJson(THEME_STORAGE_KEY, DEFAULT_THEME), readJson(SOFT_DARK_STORAGE_KEY, false));
}
