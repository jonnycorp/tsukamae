import { createContext, useCallback, useContext, useMemo, useRef } from 'react';

import { DEFAULT_THEME, findTheme } from '../../palette/themes';
import { DISPLAY_MODES } from '../../utils/display-modes';
import { DISPLAY_STORAGE_KEY, LOCATION_TINTS_STORAGE_KEY, STILL_STORAGE_KEY, THEME_STORAGE_KEY, TYPEFACES_STORAGE_KEY, fadeDisplay } from '../../palette/apply-theme';
import { useLocalStorage } from '../use-local-storage';

import type { DisplayMode } from '../../utils/display-modes';
import type { Locale } from '../../i18n/translations';
import type { ReactNode } from 'react';

// the language: every tile reads it, so nothing else lives here to re-render them all
interface PreferencesState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

// kept apart so a theme switch doesn't re-render every tile; the display switches ride along, read off the root
// (applyDisplay) rather than by the tiles
interface ThemeState {
  theme: string;
  setTheme: (theme: string) => void;
  locationTints: boolean;
  setLocationTints: (on: boolean) => void;
  // nothing on the page moves (applyDisplay): for long sessions, or the dex left up on another screen
  still: boolean;
  setStill: (on: boolean) => void;
  // the themes' own typefaces for headings and figures (applyDisplay), or the app's own everywhere
  typefaces: boolean;
  setTypefaces: (on: boolean) => void;
}

// the sealed tiles' pages (utils/display-modes), which the flips' strips draw and their picker offers, so it's kept
// apart from the theme's switches, which no tile reads
interface DisplayState {
  display: DisplayMode;
  // a mode, or one worked out from the last asked for (O's next), which a switch still fading out hasn't shown yet
  setDisplay: (display: DisplayMode | ((current: DisplayMode) => DisplayMode)) => void;
}

const PreferencesContext = createContext<PreferencesState>({
  locale: 'en',
  setLocale: () => {},
});

const ThemeContext = createContext<ThemeState>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  locationTints: true,
  setLocationTints: () => {},
  still: false,
  setStill: () => {},
  typefaces: true,
  setTypefaces: () => {},
});

const DisplayContext = createContext<DisplayState>({
  display: 'hexagon',
  setDisplay: () => {},
});

interface Props {
  children: ReactNode;
}

export const LocalStorageContextProvider = ({ children }: Props) => {
  const [locale, setLocale] = useLocalStorage<Locale>('locale', 'en');
  const [storedTheme, setTheme] = useLocalStorage(THEME_STORAGE_KEY, DEFAULT_THEME);
  // a name no theme has any more (1.2's Sakura, Peach Milk…) renders as the default, so the menu ticks that
  const theme = findTheme(storedTheme).name;
  const [locationTints, setLocationTints] = useLocalStorage(LOCATION_TINTS_STORAGE_KEY, true);
  const [still, setStill] = useLocalStorage(STILL_STORAGE_KEY, false);
  const [typefaces, setTypefaces] = useLocalStorage(TYPEFACES_STORAGE_KEY, true);
  const [storedDisplay, storeDisplay] = useLocalStorage<DisplayMode>(DISPLAY_STORAGE_KEY, 'hexagon');
  const display = DISPLAY_MODES.includes(storedDisplay) ? storedDisplay : 'hexagon';
  // switched out of sight, the dex's flips faded out and back in around it (fadeDisplay); the mode already asked for
  // is no switch at all
  const requested = useRef(display);
  const setDisplay = useCallback((next: DisplayMode | ((current: DisplayMode) => DisplayMode)) => {
    const target = typeof next === 'function' ? next(requested.current) : next;
    if (target !== requested.current) {
      requested.current = target;
      fadeDisplay(() => storeDisplay(target));
    }
  }, [storeDisplay]);

  const preferences = useMemo<PreferencesState>(() => ({ locale, setLocale }), [locale, setLocale]);

  const themeState = useMemo<ThemeState>(
    () => ({ theme, setTheme, locationTints, setLocationTints, still, setStill, typefaces, setTypefaces }),
    [theme, setTheme, locationTints, setLocationTints, still, setStill, typefaces, setTypefaces],
  );

  const displayState = useMemo<DisplayState>(() => ({ display, setDisplay }), [display, setDisplay]);

  return (
    <PreferencesContext.Provider value={preferences}>
      <ThemeContext.Provider value={themeState}>
        <DisplayContext.Provider value={displayState}>
          {children}
        </DisplayContext.Provider>
      </ThemeContext.Provider>
    </PreferencesContext.Provider>
  );
};

export const useLocalStorageContext = () => useContext(PreferencesContext);

export const useThemeContext = () => useContext(ThemeContext);

export const useDisplayContext = () => useContext(DisplayContext);
