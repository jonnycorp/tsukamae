import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVenus, faMars } from '@fortawesome/free-solid-svg-icons';

import { useTranslation } from '../../hooks/use-translation';

import type { Locale } from '../../i18n/translations';

interface Props {
  name: string;
  nameJa?: string | null;
}

// the name as the UI shows it, and as a right-click copies it (with its ♂ or ♀, which PokemonName draws as an icon)
export function displayName (name: string, nameJa: string | null | undefined, locale: Locale): string {
  return (locale === 'ja' && nameJa) || name;
}

export function PokemonName ({ name, nameJa }: Props) {
  const { locale } = useTranslation();

  const shown = displayName(name, nameJa, locale);

  const male = shown.includes('♂');
  const female = shown.includes('♀');

  if (!male && !female) {
    return <>{shown}</>;
  }

  return (
    <>
      {shown.replace(/[♂♀]/g, '')}
      {male && <FontAwesomeIcon className="name-gender" icon={faMars} />}
      {female && <FontAwesomeIcon className="name-gender" icon={faVenus} />}
    </>
  );
}
