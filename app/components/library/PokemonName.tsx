import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVenus, faMars } from '@fortawesome/free-solid-svg-icons';

import { useTranslation } from '../../hooks/use-translation';

interface Props {
  name: string;
  nameJa?: string | null;
}

export function PokemonName ({ name, nameJa }: Props) {
  const { locale } = useTranslation();

  const displayName = (locale === 'ja' && nameJa) || name;

  const male = displayName.includes('♂');
  const female = displayName.includes('♀');

  if (!male && !female) {
    return <>{displayName}</>;
  }

  return (
    <>
      {displayName.replace(/[♂♀]/g, '')}
      {male && <FontAwesomeIcon className="name-gender" icon={faMars} />}
      {female && <FontAwesomeIcon className="name-gender" icon={faVenus} />}
    </>
  );
}
