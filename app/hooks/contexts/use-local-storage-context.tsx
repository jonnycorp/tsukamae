import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../use-local-storage';

import { DEFAULT_THEME } from '../../palette/tokens';
import { SOFT_DARK_STORAGE_KEY, THEME_STORAGE_KEY } from '../../palette/apply-theme';

import type { Locale } from '../../i18n/translations';
import type { ReactNode } from 'react';
import type { SetLocalStorageFn } from '../use-local-storage';

interface LocalStorageContextState {
  hideNotification: boolean;
  setHideNotification: SetLocalStorageFn<boolean>;
  theme: string;
  setTheme: SetLocalStorageFn<string>;
  isSoftDark: boolean;
  setIsSoftDark: SetLocalStorageFn<boolean>;
  // progress bars: plain caught fill vs per-status segments (click toggles)
  showProgressBreakdown: boolean;
  setShowProgressBreakdown: SetLocalStorageFn<boolean>;
  // tile metadata displays (independent switches; groundwork for the v1.3 filters)
  showOriginMarks: boolean;
  setShowOriginMarks: SetLocalStorageFn<boolean>;
  showLanguageTags: boolean;
  setShowLanguageTags: SetLocalStorageFn<boolean>;
  // the app's UI language (distinct from a mon's per-capture origin language)
  locale: Locale;
  setLocale: SetLocalStorageFn<Locale>;
}

const LocalStorageContext = createContext<LocalStorageContextState>({
  hideNotification: false,
  setHideNotification: () => {},
  theme: DEFAULT_THEME,
  setTheme: () => {},
  isSoftDark: false,
  setIsSoftDark: () => {},
  showProgressBreakdown: false,
  setShowProgressBreakdown: () => {},
  showOriginMarks: false,
  setShowOriginMarks: () => {},
  showLanguageTags: false,
  setShowLanguageTags: () => {},
  locale: 'en',
  setLocale: () => {},
});

interface Props {
  children: ReactNode;
}

export const LocalStorageContextProvider = ({ children }: Props) => {
  const [hideNotification, setHideNotification] = useLocalStorage('notif-2024.01.20', { defaultValue: false, parseAsJson: true });
  const [theme, setTheme] = useLocalStorage<string>(THEME_STORAGE_KEY, { defaultValue: DEFAULT_THEME, parseAsJson: true });
  const [isSoftDark, setIsSoftDark] = useLocalStorage(SOFT_DARK_STORAGE_KEY, { defaultValue: false, parseAsJson: true });
  const [showProgressBreakdown, setShowProgressBreakdown] = useLocalStorage('progressBreakdown', { defaultValue: false, parseAsJson: true });
  const [showOriginMarks, setShowOriginMarks] = useLocalStorage('originMarks', { defaultValue: false, parseAsJson: true });
  const [showLanguageTags, setShowLanguageTags] = useLocalStorage('languageTags', { defaultValue: false, parseAsJson: true });
  const [locale, setLocale] = useLocalStorage<Locale>('locale', { defaultValue: 'en', parseAsJson: true });

  const contextValue = useMemo<LocalStorageContextState>(() => ({
    hideNotification,
    setHideNotification,
    theme,
    setTheme,
    isSoftDark,
    setIsSoftDark,
    showProgressBreakdown,
    setShowProgressBreakdown,
    showOriginMarks,
    setShowOriginMarks,
    showLanguageTags,
    setShowLanguageTags,
    locale,
    setLocale,
  }), [
    hideNotification,
    setHideNotification,
    theme,
    setTheme,
    isSoftDark,
    setIsSoftDark,
    showProgressBreakdown,
    setShowProgressBreakdown,
    showOriginMarks,
    setShowOriginMarks,
    showLanguageTags,
    setShowLanguageTags,
    locale,
    setLocale,
  ]);

  return (
    <LocalStorageContext.Provider value={contextValue}>
      {children}
    </LocalStorageContext.Provider>
  );
};

export const useLocalStorageContext = () => {
  return useContext(LocalStorageContext);
};
