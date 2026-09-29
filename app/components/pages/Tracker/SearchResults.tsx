import { useMemo } from 'react';

import { BOX_COLUMNS } from '../../../utils/pokemon';
import { EMPTY_FILTERS, appliedFacets, filterMatcher, queryMatcher } from './filters';
import { FlipStrips } from './FlipStrips';
import { Pokemon } from './Pokemon';
import { useTrackerActions } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { Dispatch, SetStateAction } from 'react';
import type { TrackerFilters } from './filters';

interface Props {
  captures: Capture[];
  filters: TrackerFilters;
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export function SearchResults ({ captures, filters, query, setFilters, setQuery, setSelectedPokemon }: Props) {
  const { narrow } = useTrackerActions();
  const { t } = useTranslation();

  const results = useMemo(() => {
    const matchesFilters = filterMatcher(filters);
    const matchesQuery = queryMatcher(query);
    return captures.filter((capture) => matchesFilters(capture) && matchesQuery(capture));
  }, [captures, filters, query]);

  if (results.length === 0) {
    const viewOnly = !query && appliedFacets(filters).length === 0;
    const clearFilters = <a className="link" onClick={() => setFilters(EMPTY_FILTERS)}>{t('searchResults.clearFilters')}</a>;
    const clearSearch = <a className="link" onClick={() => setQuery('')}>{t('searchResults.clearSearch')}</a>;

    let message = <p>{t('searchResults.noneMatching')} {query && clearSearch} {clearFilters}</p>;
    if (viewOnly && filters.view === 'missing') {
      message = <p>{t('searchResults.allMarked')} <a className="link" onClick={() => setFilters(EMPTY_FILTERS)}>{t('searchResults.showAll')}</a></p>;
    } else if (viewOnly && filters.view === 'temporary') {
      message = <p>{t('searchResults.noTemporary')} <a className="link" onClick={() => setFilters(EMPTY_FILTERS)}>{t('searchResults.showAll')}</a></p>;
    } else if (filters.view === 'all' && appliedFacets(filters).length === 0) {
      message = <p>{t('searchResults.none')} {clearSearch}</p>;
    }

    return (
      <div className="search-results search-results-empty">
        {message}
      </div>
    );
  }

  // empty slots square off the last row, like a box's
  return (
    <div className="search-results">
      <div className="tile-grid">
        {results.map((capture) => (
          <Pokemon capture={capture} key={capture.pokemon.id} setSelectedPokemon={setSelectedPokemon} />
        ))}
        {Array.from({ length: (BOX_COLUMNS - (results.length % BOX_COLUMNS)) % BOX_COLUMNS }, (_, i) => (
          <div className="pokemon empty" key={`empty-${i}`}>
            <div className="set-captured" />
          </div>
        ))}
      </div>
      {!narrow && <FlipStrips grids={[results]} />}
    </div>
  );
}
