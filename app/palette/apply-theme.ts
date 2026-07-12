import { DEFAULT_THEME, PALETTE_PRESETS, TOKEN_NAMES, cssValue, resolvePalette } from './tokens';
import { localStorage } from '../utils/local-storage';

// Themes override the :root tokens at runtime; the compiled CSS is the default theme.

export const THEME_STORAGE_KEY = 'theme';
export const SOFT_DARK_STORAGE_KEY = 'nightMode';

export function setRootTokens (values: Record<string, string> | null) {
  const root = document.documentElement;
  if (values === null) {
    for (const name of TOKEN_NAMES) {
      root.style.removeProperty(`--${name}`);
    }
    return;
  }
  for (const [name, value] of Object.entries(values)) {
    root.style.setProperty(`--${name}`, value);
  }
}

export function applyTheme (name: string) {
  // Unknown names (stale storage after a theme rename) also fall back to the default.
  if (name === DEFAULT_THEME || !PALETTE_PRESETS[name]) {
    setRootTokens(null);
    return;
  }
  const resolved = resolvePalette(PALETTE_PRESETS[name]);
  const values: Record<string, string> = {};
  for (const token of TOKEN_NAMES) {
    values[token] = cssValue(resolved[token]);
  }
  setRootTokens(values);
}

function readJson<T> (key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Pre-render pass (index.tsx) so a non-default theme or soft dark doesn't flash on launch.
export function bootstrapTheme () {
  applyTheme(readJson(THEME_STORAGE_KEY, DEFAULT_THEME));
  document.documentElement.classList.toggle('soft-dark', readJson(SOFT_DARK_STORAGE_KEY, false));
}
