import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVenus, faMars } from '@fortawesome/free-solid-svg-icons';

import { useTranslation } from '../../hooks/use-translation';

interface Props {
  name: string;
  // Katakana species name; shown when the UI locale is Japanese. Falls back to
  // the English name for entries that don't have one.
  nameJa?: string | null;
}

export function PokemonName ({ name, nameJa }: Props) {
  const { locale } = useTranslation();

  const displayName = (locale === 'ja' && nameJa) || name;

  const male = displayName.indexOf('♂') > -1;
  const female = displayName.indexOf('♀') > -1;

  if (!male && !female) {
    return <>{displayName}</>;
  }

  return (
    <>
      {displayName.replace(/[♂♀]/g, '')}
      {male && <FontAwesomeIcon icon={faMars} />}
      {female && <FontAwesomeIcon icon={faVenus} />}
    </>
  );
}
