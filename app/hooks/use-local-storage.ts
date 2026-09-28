import { useCallback, useState } from 'react';

export function useLocalStorage<T> (key: string, defaultValue: T): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback((value: T) => {
    window.localStorage.setItem(key, JSON.stringify(value));
    setStored(value);
  }, [key]);

  return [stored, setValue];
}
