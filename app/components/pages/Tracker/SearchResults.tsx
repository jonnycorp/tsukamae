import { Fragment, memo, useMemo } from 'react';

import { BOX_COLUMNS, BOX_SIZE } from '../../../utils/pokemon';
import { EMPTY_FILTERS, appliedFacets, filterMatcher, hasQuery, queryMatcher } from './filters';
import { FlipStrips } from './FlipStrips';
import { Pokemon } from './Pokemon';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { shineClip, useTrackerActions } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { FilterView, TrackerFilters } from './filters';
import type { TranslationKey } from '../../../i18n/translations';

// a view emptied out says so in its own words
const VIEW_EMPTY: Partial<Record<FilterView, TranslationKey>> = {
  missing: 'searchResults.allMarked',
  temporary: 'searchResults.noTemporary',
  unsealed: 'searchResults.noUnsealed',
  incomplete: 'searchResults.noIncomplete',
};

interface ChunkProps {
  captures: Capture[];
  // empty slots that square off the last row, like a box's
  padding: number;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

function sameChunk (prev: ChunkProps, next: ChunkProps): boolean {
  return prev.padding === next.padding &&
    prev.setSelectedPokemon === next.setSelectedPokemon &&
    prev.captures.length === next.captures.length &&
    prev.captures.every((capture, i) => capture === next.captures[i]);
}

// a box's worth of results drawn as a box is, its title aside: its own shine and flips over its own grid, so a sealed
// tile looks the same in every view, an offscreen chunk skips its work, and an edit re-renders one chunk, not the list
const ResultsChunk = memo(function ResultsChunk ({ captures, padding, setSelectedPokemon }: ChunkProps) {
  const { activeDex } = useDexContext();
  const { sealFx, narrow } = useTrackerActions();
  const checklist = Boolean(activeDex!.checklist);

  const clip = useMemo(() => (narrow ? null : shineClip(captures, checklist, sealFx)), [captures, checklist, sealFx, narrow]);

  return (
    <div className="results-chunk">
      <div className="tile-grid">
        {captures.map((capture) => (
          <Pokemon capture={capture} key={capture.pokemon.id} setSelectedPokemon={setSelectedPokemon} />
        ))}
        {Array.from({ length: padding }, (_, i) => (
          <div className="pokemon empty" key={`empty-${i}`}>
            <div className="set-captured" />
          </div>
        ))}
      </div>
      {clip &&
        <div className="box-shine" style={{ clipPath: clip }}>
          <div className="box-shine-band" />
        </div>
      }
      {!narrow && <FlipStrips grids={[captures]} />}
    </div>
  );
}, sameChunk);

interface Props {
  captures: Capture[];
  filters: TrackerFilters;
  // shown though they no longer match: tiles the open popover has worked on (useHeldTiles in Dex)
  held: number[];
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export function SearchResults ({ captures, filters, held, query, setFilters, setQuery, setSelectedPokemon }: Props) {
  const { activeDexView } = useDexContext();
  const { t, locale } = useTranslation();
  const regional = Boolean(activeDexView?.regional);
  const searching = hasQuery(query);

  const results = useMemo(() => {
    const matchesFilters = filterMatcher(filters);
    const matchesQuery = queryMatcher(query, regional);
    return captures.filter((capture) => held.includes(capture.pokemon.id) || (matchesFilters(capture) && matchesQuery(capture)));
  }, [captures, filters, held, query, regional]);

  const chunks = useMemo(() => {
    const all: Capture[][] = [];
    for (let i = 0; i < results.length; i += BOX_SIZE) {
      all.push(results.slice(i, i + BOX_SIZE));
    }
    return all;
  }, [results]);

  if (results.length === 0) {
    const viewOnly = !searching && appliedFacets(filters).length === 0;
    const viewEmpty = VIEW_EMPTY[filters.view];
    const clearFilters = <a className="link" onClick={() => setFilters(EMPTY_FILTERS)}>{t('searchResults.clearFilters')}</a>;
    const clearSearch = <a className="link" onClick={() => setQuery('')}>{t('searchResults.clearSearch')}</a>;
    const showAll = <a className="link" onClick={() => setFilters(EMPTY_FILTERS)}>{t('searchResults.showAll')}</a>;

    let parts: ReactNode[] = [t('searchResults.noneMatching'), searching && clearSearch, clearFilters];
    if (viewOnly && viewEmpty) {
      parts = [t(viewEmpty), showAll];
    } else if (filters.view === 'all' && appliedFacets(filters).length === 0) {
      parts = [t('searchResults.none'), clearSearch];
    }
    // English spaces its sentences apart; Japanese runs on straight after the 。
    const gap = locale === 'ja' ? '' : ' ';

    return (
      <div className="search-results search-results-empty">
        <p>{parts.filter(Boolean).map((part, i) => <Fragment key={i}>{i > 0 && gap}{part}</Fragment>)}</p>
      </div>
    );
  }

  return (
    <div className="search-results">
      {chunks.map((chunk, c) => (
        <ResultsChunk
          captures={chunk}
          // by position: a chunk is a slice, not an identity
          key={c}
          padding={c === chunks.length - 1 ? (BOX_COLUMNS - (chunk.length % BOX_COLUMNS)) % BOX_COLUMNS : 0}
          setSelectedPokemon={setSelectedPokemon}
        />
      ))}
    </div>
  );
}
