import { createContext, useContext, useMemo } from 'react';

import { DEFAULT_THEME, findTheme } from '../../palette/themes';
import { FLIP_TYPES_STORAGE_KEY, LOCATION_TINTS_STORAGE_KEY, SOFT_DARK_STORAGE_KEY, STILL_STORAGE_KEY, THEME_STORAGE_KEY, TILE_TYPES_STORAGE_KEY } from '../../palette/apply-theme';
import { useLocalStorage } from '../use-local-storage';

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
  isSoftDark: boolean;
  setIsSoftDark: (softDark: boolean) => void;
  locationTints: boolean;
  setLocationTints: (on: boolean) => void;
  flipTypes: boolean;
  setFlipTypes: (on: boolean) => void;
  tileTypes: boolean;
  setTileTypes: (on: boolean) => void;
  // nothing on the page moves (applyDisplay): for long sessions, or the dex left up on another screen
  still: boolean;
  setStill: (on: boolean) => void;
}

const PreferencesContext = createContext<PreferencesState>({
  locale: 'en',
  setLocale: () => {},
});

const ThemeContext = createContext<ThemeState>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  isSoftDark: false,
  setIsSoftDark: () => {},
  locationTints: true,
  setLocationTints: () => {},
  flipTypes: true,
  setFlipTypes: () => {},
  tileTypes: false,
  setTileTypes: () => {},
  still: false,
  setStill: () => {},
});

interface Props {
  children: ReactNode;
}

export const LocalStorageContextProvider = ({ children }: Props) => {
  const [locale, setLocale] = useLocalStorage<Locale>('locale', 'en');
  const [storedTheme, setTheme] = useLocalStorage(THEME_STORAGE_KEY, DEFAULT_THEME);
  // a name no theme has any more (1.2's Sakura, Peach Milk…) renders as the default, so the menu ticks that
  const theme = findTheme(storedTheme).name;
  const [isSoftDark, setIsSoftDark] = useLocalStorage(SOFT_DARK_STORAGE_KEY, false);
  const [locationTints, setLocationTints] = useLocalStorage(LOCATION_TINTS_STORAGE_KEY, true);
  const [flipTypes, setFlipTypes] = useLocalStorage(FLIP_TYPES_STORAGE_KEY, true);
  const [tileTypes, setTileTypes] = useLocalStorage(TILE_TYPES_STORAGE_KEY, false);
  const [still, setStill] = useLocalStorage(STILL_STORAGE_KEY, false);

  const preferences = useMemo<PreferencesState>(() => ({ locale, setLocale }), [locale, setLocale]);

  const themeState = useMemo<ThemeState>(
    () => ({ theme, setTheme, isSoftDark, setIsSoftDark, locationTints, setLocationTints, flipTypes, setFlipTypes, tileTypes, setTileTypes, still, setStill }),
    [theme, setTheme, isSoftDark, setIsSoftDark, locationTints, setLocationTints, flipTypes, setFlipTypes, tileTypes, setTileTypes, still, setStill],
  );

  return (
    <PreferencesContext.Provider value={preferences}>
      <ThemeContext.Provider value={themeState}>
        {children}
      </ThemeContext.Provider>
    </PreferencesContext.Provider>
  );
};

export const useLocalStorageContext = () => useContext(PreferencesContext);

export const useThemeContext = () => useContext(ThemeContext);
