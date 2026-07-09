import { useMemo } from 'react';

import { Pokemon } from './Pokemon';
import { nationalId, padding } from '../../../utils/formatting';
import { useTranslation } from '../../../hooks/use-translation';

import type { Dispatch, SetStateAction } from 'react';
import type { UICapture } from './use-tracker';

const DEFER_CUTOFF = 120;

// Japanese names are katakana, but typing produces hiragana first — normalize
// so ふしぎだね matches フシギダネ. (Hiragana and katakana blocks are 0x60 apart.)
function toKatakana (value: string): string {
  return value.replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
}

interface Props {
  captures: UICapture[];
  hideCaught: boolean;
  query: string;
  setHideCaught: Dispatch<SetStateAction<boolean>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
  setTemporaryOnly: Dispatch<SetStateAction<boolean>>;
  temporaryOnly: boolean;
}

export function SearchResults ({ captures, hideCaught, query, setHideCaught, setQuery, setSelectedPokemon, setTemporaryOnly, temporaryOnly }: Props) {
  const { t } = useTranslation();

  const handleClearCaughtFilter = () => setHideCaught(false);
  const handleClearTemporaryFilter = () => setTemporaryOnly(false);
  const handleClearClick = () => setQuery('');

  const filteredCaptures = useMemo(() => {
    return captures.filter((capture) => {
      const dexId = capture.pokemon.dex_number;
      const natId = nationalId(capture.pokemon.national_id);

      const matchesCaught = !hideCaught || !capture.captured;
      const matchesTemporary = !temporaryOnly || capture.status === 'temporary';
      const matchesQuery =
        // Case-insensitive name prefix match (e.g. bulba)
        capture.pokemon.name.toLowerCase().indexOf(query.toLowerCase()) === 0 ||
        // Japanese name prefix match, hiragana or katakana (e.g. ふしぎ / フシギ)
        (capture.pokemon.name_ja || '').indexOf(toKatakana(query)) === 0 ||
        // Exact dex ID match (e.g. 1, 2, 3)
        dexId.toString() === query ||
        // Exact national ID match (e.g. 1, 2, 3)
        natId.toString() === query ||
        // Exact 3-digit formatted dex ID match (e.g. 001, 002, 003)
        padding(dexId, 3) === query ||
        // Exact 4-digit formatted dex ID match (e.g. 0001, 0002, 0003)
        padding(dexId, 4) === query ||
        // Exact 3-digit formatted national ID match (e.g. 001, 002, 003)
        padding(natId, 3) === query ||
        // Exact 4-digit formatted national ID match (e.g. 0001, 0002, 0003)
        padding(natId, 4) === query;

      return matchesCaught && matchesTemporary && matchesQuery;
    });
  }, [captures, hideCaught, query, temporaryOnly]);

  if (filteredCaptures.length === 0) {
    // Standalone sentence + standalone link actions: English mid-sentence links
    // don't survive translation (Japanese word order differs), so both locales
    // get the same simple structure.
    let message = <p>{t('searchResults.none')} <a className="link" onClick={handleClearClick}>{t('searchResults.clearSearch')}</a></p>;

    if (hideCaught) {
      if (query) {
        message = <p>{t('searchResults.noneUncaught')} <a className="link" onClick={handleClearCaughtFilter}>{t('searchResults.includeCaught')}</a> <a className="link" onClick={handleClearClick}>{t('searchResults.clearSearch')}</a></p>;
      } else {
        message = <p>{t('searchResults.allCaught')} <a className="link" onClick={handleClearCaughtFilter}>{t('searchResults.showAll')}</a></p>;
      }
    } else if (temporaryOnly) {
      message = <p>{t(query ? 'searchResults.noTemporaryMatching' : 'searchResults.noTemporary')} <a className="link" onClick={handleClearTemporaryFilter}>{t('searchResults.showAll')}</a></p>;
    }

    return (
      <div className="search-results search-results-empty">
        {message}
      </div>
    );
  }

  return (
    <div className="search-results">
      {filteredCaptures.map((capture, i) => (
        <Pokemon
          capture={capture}
          delay={i > DEFER_CUTOFF ? 5 : 0}
          key={capture.pokemon.id}
          setSelectedPokemon={setSelectedPokemon}
        />
      ))}
    </div>
  );
}
