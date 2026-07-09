import { useCallback } from 'react';

import { translate } from '../i18n/translations';
import { useLocalStorageContext } from './contexts/use-local-storage-context';

import type { TranslationKey } from '../i18n/translations';

// UI translation. `t('some.key')` returns the string for the active locale,
// falling back to English (then the key itself) if a translation is missing.
// `{token}` placeholders are filled from params: t('x.y', { token: value }).
export function useTranslation () {
  const { locale } = useLocalStorageContext();

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  return { t, locale };
}
