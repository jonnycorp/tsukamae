import { createContext, useContext, useMemo } from 'react';
import { useLocalStorage } from '../use-local-storage';

import type { Locale } from '../../i18n/translations';
import type { ReactNode } from 'react';
import type { SetLocalStorageFn } from '../use-local-storage';

interface LocalStorageContextState {
  hideNotification: boolean;
  setHideNotification: SetLocalStorageFn<boolean>;
  isNightMode: boolean;
  setIsNightMode: SetLocalStorageFn<boolean>;
  // The app's UI language (distinct from a mon's per-capture origin language).
  locale: Locale;
  setLocale: SetLocalStorageFn<Locale>;
}

const LocalStorageContext = createContext<LocalStorageContextState>({
  hideNotification: false,
  setHideNotification: () => {},
  isNightMode: false,
  setIsNightMode: () => {},
  locale: 'en',
  setLocale: () => {},
});

interface Props {
  children: ReactNode;
}

export const LocalStorageContextProvider = ({ children }: Props) => {
  const [hideNotification, setHideNotification] = useLocalStorage('notif-2024.01.20', { defaultValue: false, parseAsJson: true });
  const [isNightMode, setIsNightMode] = useLocalStorage('nightMode', { defaultValue: true, parseAsJson: true });
  const [locale, setLocale] = useLocalStorage<Locale>('locale', { defaultValue: 'en', parseAsJson: true });

  const contextValue = useMemo<LocalStorageContextState>(() => ({
    hideNotification,
    setHideNotification,
    isNightMode,
    setIsNightMode,
    locale,
    setLocale,
  }), [
    hideNotification,
    setHideNotification,
    isNightMode,
    setIsNightMode,
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
