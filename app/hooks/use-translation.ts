import { useCallback } from 'react';

import { translate } from '../i18n/translations';
import { useLocalStorageContext } from './contexts/use-local-storage-context';

import type { TranslationKey } from '../i18n/translations';

export function useTranslation () {
  const { locale } = useLocalStorageContext();

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  return { t, locale };
}
