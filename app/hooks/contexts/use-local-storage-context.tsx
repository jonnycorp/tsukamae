import { createContext, useContext, useMemo } from 'react';

import { DEFAULT_THEME, findTheme } from '../../palette/themes';
import { SOFT_DARK_STORAGE_KEY, THEME_STORAGE_KEY } from '../../palette/apply-theme';
import { useLocalStorage } from '../use-local-storage';

import type { Locale } from '../../i18n/translations';
import type { ReactNode } from 'react';

// the language: every tile reads it, so nothing else lives here to re-render them all
interface PreferencesState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

// kept apart so a theme switch doesn't re-render every tile
interface ThemeState {
  theme: string;
  setTheme: (theme: string) => void;
  isSoftDark: boolean;
  setIsSoftDark: (softDark: boolean) => void;
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

  const preferences = useMemo<PreferencesState>(() => ({ locale, setLocale }), [locale, setLocale]);

  const themeState = useMemo<ThemeState>(
    () => ({ theme, setTheme, isSoftDark, setIsSoftDark }),
    [theme, setTheme, isSoftDark, setIsSoftDark],
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
