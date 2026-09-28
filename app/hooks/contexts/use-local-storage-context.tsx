import { createContext, useContext, useMemo } from 'react';

import { DEFAULT_THEME } from '../../palette/tokens';
import { SOFT_DARK_STORAGE_KEY, THEME_STORAGE_KEY } from '../../palette/apply-theme';
import { useLocalStorage } from '../use-local-storage';

import type { Locale } from '../../i18n/translations';
import type { ReactNode } from 'react';

interface PreferencesState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  showProgressBreakdown: boolean;
  setShowProgressBreakdown: (show: boolean) => void;
  showLanguageTags: boolean;
  setShowLanguageTags: (show: boolean) => void;
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
  showProgressBreakdown: false,
  setShowProgressBreakdown: () => {},
  showLanguageTags: false,
  setShowLanguageTags: () => {},
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
  const [showProgressBreakdown, setShowProgressBreakdown] = useLocalStorage('progressBreakdown', false);
  const [showLanguageTags, setShowLanguageTags] = useLocalStorage('languageTags', false);
  const [theme, setTheme] = useLocalStorage(THEME_STORAGE_KEY, DEFAULT_THEME);
  const [isSoftDark, setIsSoftDark] = useLocalStorage(SOFT_DARK_STORAGE_KEY, false);

  const preferences = useMemo<PreferencesState>(() => ({
    locale,
    setLocale,
    showProgressBreakdown,
    setShowProgressBreakdown,
    showLanguageTags,
    setShowLanguageTags,
  }), [locale, setLocale, showProgressBreakdown, setShowProgressBreakdown, showLanguageTags, setShowLanguageTags]);

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
