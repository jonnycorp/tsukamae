import { useMemo } from 'react';

import { EMPTY_FILTERS, matchesFilters } from './use-tracker';
import { Pokemon } from './Pokemon';
import { nationalId, padding } from '../../../utils/formatting';
import { useTranslation } from '../../../hooks/use-translation';

import type { Dispatch, SetStateAction } from 'react';
import type { TrackerFilters, UICapture } from './use-tracker';

const DEFER_CUTOFF = 120;

// typing produces hiragana; names are katakana
function toKatakana (value: string): string {
  return value.replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
}

interface Props {
  captures: UICapture[];
  filters: TrackerFilters;
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export function SearchResults ({ captures, filters, query, setFilters, setQuery, setSelectedPokemon }: Props) {
  const { t } = useTranslation();

  const handleClearMarkedFilter = () => setFilters((prev) => ({ ...prev, hideMarked: false }));
  const handleClearTemporaryFilter = () => setFilters((prev) => ({ ...prev, temporaryOnly: false }));
  const handleClearAllFilters = () => setFilters(EMPTY_FILTERS);
  const handleClearClick = () => setQuery('');

  const filteredCaptures = useMemo(() => {
    return captures.filter((capture) => {
      const dexId = capture.pokemon.dex_number;
      const natId = nationalId(capture.pokemon.national_id);

      const matchesQuery =
        // case-insensitive name prefix match (e.g. bulba)
        capture.pokemon.name.toLowerCase().indexOf(query.toLowerCase()) === 0 ||
        // japanese name prefix match, hiragana or katakana (e.g. ふしぎ / フシギ)
        (capture.pokemon.name_ja || '').indexOf(toKatakana(query)) === 0 ||
        // nickname match
        (capture.nickname || '').toLowerCase().indexOf(query.toLowerCase()) === 0 ||
        // exact dex ID match (e.g. 1, 2, 3)
        dexId.toString() === query ||
        // exact national ID match (e.g. 1, 2, 3)
        natId.toString() === query ||
        // exact 3-digit formatted dex ID match (e.g. 001, 002, 003)
        padding(dexId, 3) === query ||
        // exact 4-digit formatted dex ID match (e.g. 0001, 0002, 0003)
        padding(dexId, 4) === query ||
        // exact 3-digit formatted national ID match (e.g. 001, 002, 003)
        padding(natId, 3) === query ||
        // exact 4-digit formatted national ID match (e.g. 0001, 0002, 0003)
        padding(natId, 4) === query;

      return matchesFilters(capture, filters) && matchesQuery;
    });
  }, [captures, filters, query]);

  if (filteredCaptures.length === 0) {
    let message = <p>{t('searchResults.none')} <a className="link" onClick={handleClearClick}>{t('searchResults.clearSearch')}</a></p>;

    if (filters.hideMarked) {
      if (query) {
        message = <p>{t('searchResults.noneUnmarked')} <a className="link" onClick={handleClearMarkedFilter}>{t('searchResults.includeMarked')}</a> <a className="link" onClick={handleClearClick}>{t('searchResults.clearSearch')}</a></p>;
      } else {
        message = <p>{t('searchResults.allMarked')} <a className="link" onClick={handleClearMarkedFilter}>{t('searchResults.showAll')}</a></p>;
      }
    } else if (filters.temporaryOnly) {
      message = <p>{t(query ? 'searchResults.noTemporaryMatching' : 'searchResults.noTemporary')} <a className="link" onClick={handleClearTemporaryFilter}>{t('searchResults.showAll')}</a></p>;
    } else if (filters.unsealedOnly || filters.incompleteOnly || filters.favoritesOnly) {
      message = <p>{t('searchResults.noneMatching')} <a className="link" onClick={handleClearAllFilters}>{t('searchResults.clearFilters')}</a></p>;
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
