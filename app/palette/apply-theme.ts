import { DEFAULT_THEME, findTheme, themePalette } from './themes';

export const THEME_STORAGE_KEY = 'theme';
export const SOFT_DARK_STORAGE_KEY = 'nightMode';

export function applyTheme (name: string, softDark: boolean) {
  const root = document.documentElement;
  for (const [token, value] of Object.entries(themePalette(findTheme(name), softDark ? 'dark' : 'light'))) {
    root.style.setProperty(`--${token}`, value);
  }
  root.classList.toggle('soft-dark', softDark);
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
