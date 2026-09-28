import { useMemo } from 'react';

import { EMPTY_FILTERS, matchesFilters } from './use-tracker';
import { Pokemon } from './Pokemon';
import { padding } from '../../../utils/formatting';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { Dispatch, SetStateAction } from 'react';
import type { TrackerFilters } from './use-tracker';

// typing produces hiragana; names are katakana
function toKatakana (value: string): string {
  return value.replace(/[ぁ-ゖ]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
}

function matchesNumber (id: number, query: string): boolean {
  return String(id) === query || padding(id, 3) === query || padding(id, 4) === query;
}

interface Props {
  captures: Capture[];
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

  const results = useMemo(() => {
    const lower = query.toLowerCase();
    const kana = toKatakana(query);
    return captures.filter((capture) => matchesFilters(capture, filters) && (
      capture.pokemon.name.toLowerCase().startsWith(lower) ||
      (capture.pokemon.name_ja || '').startsWith(kana) ||
      (capture.nickname || '').toLowerCase().startsWith(lower) ||
      matchesNumber(capture.pokemon.dex_number, query) ||
      matchesNumber(capture.pokemon.national_id, query)
    ));
  }, [captures, filters, query]);

  if (results.length === 0) {
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
      {results.map((capture) => (
        <Pokemon capture={capture} key={capture.pokemon.id} setSelectedPokemon={setSelectedPokemon} />
      ))}
    </div>
  );
}
