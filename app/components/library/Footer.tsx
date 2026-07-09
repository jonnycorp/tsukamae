import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle } from '@fortawesome/free-solid-svg-icons';

import { useTranslation } from '../../hooks/use-translation';

export function Footer () {
  const { t } = useTranslation();

  return (
    <footer className="main-footer">
      <span>{t('app.name')}</span>
      <FontAwesomeIcon icon={faCircle} />
      <a className="link" href="https://pokedextracker.com" rel="noopener noreferrer" target="_blank">{t('footer.basedOn')}</a>
    </footer>
  );
}
