import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';

import { localizeCatalogGame, localizeDexType } from '../../i18n/names';
import { useTranslation } from '../../hooks/use-translation';

import type { Dex } from '../../types';

interface Props {
  dex: Dex;
}

export function DexIndicator ({ dex }: Props) {
  const { t, locale } = useTranslation();

  return (
    <div className="dex-indicator">
      {dex.shiny && <FontAwesomeIcon icon={faStar} title={t('common.shiny')} />}
      <span className="label">{localizeDexType(locale, dex.dex_type.name)}</span>
      <span className="label">{localizeCatalogGame(locale, dex.game.id, dex.game.name)}</span>
    </div>
  );
}
