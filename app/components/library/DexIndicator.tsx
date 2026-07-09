import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar } from '@fortawesome/free-solid-svg-icons';

import { localizeCatalogGame, localizeDexType } from '../../i18n/names';
import { useTranslation } from '../../hooks/use-translation';

import type { Dex } from '../../types';

const EXCLUDED_TAGS = ['regional', 'game national', 'full national'];

interface Props {
  dex: Dex;
}

export function DexIndicator ({ dex }: Props) {
  const { t, locale } = useTranslation();

  return (
    <div className="dex-indicator">
      {dex.shiny && <FontAwesomeIcon icon={faStar} title={t('common.shiny')} />}
      {[dex.dex_type.base_dex_type?.name || dex.dex_type.name, ...dex.dex_type.tags.filter((tag) => !EXCLUDED_TAGS.includes(tag))].map((tag) => {
        const label = tag.replace(/^customization-/g, '');
        return <span className="label" key={tag}>{localizeDexType(locale, label)}</span>;
      })}
      <span className="label">{localizeCatalogGame(locale, dex.game.id, dex.game.name)}</span>
    </div>
  );
}
