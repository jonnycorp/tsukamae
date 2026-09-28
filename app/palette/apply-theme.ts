import { DEFAULT_THEME, PALETTE_PRESETS, TOKEN_NAMES, cssValue, resolvePalette } from './tokens';

export const THEME_STORAGE_KEY = 'theme';
export const SOFT_DARK_STORAGE_KEY = 'nightMode';

export function setRootTokens (values: Record<string, string>) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(values)) {
    root.style.setProperty(`--${name}`, value);
  }
}

// unknown names (a renamed theme still in storage) fall back to the default
export function applyTheme (name: string) {
  const resolved = resolvePalette(PALETTE_PRESETS[name] ?? PALETTE_PRESETS[DEFAULT_THEME]);
  const values: Record<string, string> = {};
  for (const token of TOKEN_NAMES) {
    values[token] = cssValue(resolved[token]);
  }
  setRootTokens(values);
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
  applyTheme(readJson(THEME_STORAGE_KEY, DEFAULT_THEME));
  document.documentElement.classList.toggle('soft-dark', readJson(SOFT_DARK_STORAGE_KEY, false));
}
