import { memo, useMemo } from 'react';

import { BOX_COLUMNS, BOX_SIZE } from '../../../utils/pokemon';
import { EMPTY_FILTERS, appliedFacets, filterMatcher, hasQuery, queryMatcher } from './filters';
import { FlipStrips } from './FlipStrips';
import { Pokemon } from './Pokemon';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { sealClip, sealTintClips, useTrackerActions } from './use-tracker';
import { useTranslation } from '../../../hooks/use-translation';

import type { Capture } from '../../../types';
import type { CSSProperties, Dispatch, ReactNode, SetStateAction } from 'react';
import type { FilterView, TrackerFilters } from './filters';
import type { TranslationKey } from '../../../i18n/translations';

// a view emptied out says so in its own words
const VIEW_EMPTY: Partial<Record<FilterView, TranslationKey>> = {
  missing: 'searchResults.allMarked',
  temporary: 'searchResults.noTemporary',
  unsealed: 'searchResults.noUnsealed',
  incomplete: 'searchResults.noIncomplete',
};

// a chunk's rows, a box's; and the widest results run, in boxes' worth (keep in sync with the widths styles/tracker.scss
// draws lines for)
const CHUNK_ROWS = BOX_SIZE / BOX_COLUMNS;
const MAX_BOXES_ACROSS = 8;

interface ChunkProps {
  captures: Capture[];
  // tiles across
  columns: number;
  // empty slots that square off the last row, like a box's
  padding: number;
  // after the first: its first row draws the line between it and the chunk above (styles/tracker.scss)
  ruled: boolean;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

function sameChunk (prev: ChunkProps, next: ChunkProps): boolean {
  return prev.padding === next.padding &&
    prev.ruled === next.ruled &&
    prev.columns === next.columns &&
    prev.setSelectedPokemon === next.setSelectedPokemon &&
    prev.captures.length === next.captures.length &&
    prev.captures.every((capture, i) => capture === next.captures[i]);
}

// a box's rows of results drawn as a box is, its title aside, as wide as the row of boxes they stand for: its own seal
// material under its own grid and flips over it, so a sealed tile looks the same in every view, an offscreen chunk skips its work, and an
// edit re-renders one chunk, not the list
const ResultsChunk = memo(function ResultsChunk ({ captures, columns, padding, ruled, setSelectedPokemon }: ChunkProps) {
  const { activeDex, activeDexView } = useDexContext();
  const { narrow } = useTrackerActions();
  const checklist = Boolean(activeDex!.checklist);
  const homeDex = activeDexView!.game.id === 'home';

  const clip = useMemo(() => (narrow ? null : sealClip(captures, checklist, columns)), [captures, checklist, narrow, columns]);
  const tintClips = useMemo(() => (narrow ? [] : sealTintClips(captures, checklist, homeDex, columns)), [captures, checklist, homeDex, narrow, columns]);

  // its own size while it's out of sight (styles/tracker.scss): a short last chunk's rows, not a box's five
  const size = { '--chunk-rows': Math.ceil(captures.length / columns), '--chunk-tiles': captures.length } as CSSProperties;

  return (
    <div className="results-chunk" style={size}>
      <div className="tile-grid" data-columns={columns}>
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
        <div className="seal-material" style={{ clipPath: clip }}>
          <div className="seal-flow" />
        </div>
      }
      {tintClips.map(({ tint, clip: tintClip }) => (
        <div className="seal-material" data-tint={tint} key={tint} style={{ clipPath: tintClip }}>
          <div className="seal-flow" />
        </div>
      ))}
      {!narrow && <FlipStrips columns={columns} grids={[captures]} ruled={ruled} />}
    </div>
  );
}, sameChunk);

interface NoResultsProps {
  filters: TrackerFilters;
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
}

// what an emptied view or search says, with the way back out of it; the ledger says it too
export function NoResults ({ filters, query, setFilters, setQuery }: NoResultsProps) {
  const { activeDex } = useDexContext();
  const { t } = useTranslation();
  const searching = hasQuery(query);
  const viewOnly = !searching && appliedFacets(filters).length === 0;
  // a checklist's Temporary is Elsewhere, as its view's button says
  const viewEmpty = activeDex!.checklist && filters.view === 'temporary' ? 'searchResults.noElsewhere' : VIEW_EMPTY[filters.view];
  const action = (label: TranslationKey, run: () => void) => (
    <button className="no-results-action" key={label} onClick={run} type="button">{t(label)}</button>
  );
  const clearFilters = action('searchResults.clearFilters', () => setFilters(EMPTY_FILTERS));
  const clearSearch = action('searchResults.clearSearch', () => setQuery(''));
  const showAll = action('searchResults.showAll', () => setFilters(EMPTY_FILTERS));

  let message = t('searchResults.noneMatching');
  let actions: ReactNode[] = [searching && clearSearch, clearFilters];
  if (viewOnly && viewEmpty) {
    message = t(viewEmpty);
    actions = [showAll];
  } else if (filters.view === 'all' && appliedFacets(filters).length === 0) {
    // with no search either, it's the dex that holds nothing (a free-form dex starts out empty)
    message = t(searching ? 'searchResults.none' : 'searchResults.empty');
    actions = searching ? [clearSearch] : [];
  }

  return (
    <div className="search-results search-results-empty">
      <p>{message}</p>
      <div className="no-results-actions">{actions.filter(Boolean)}</div>
    </div>
  );
}

interface Props {
  captures: Capture[];
  // boxes across the grid the results stand in for
  columns: number;
  filters: TrackerFilters;
  // shown though they no longer match: tiles the open popover has worked on, or a press marked (useHeldTiles in Dex)
  held: number[];
  query: string;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

export function SearchResults ({ captures, columns, filters, held, query, setFilters, setQuery, setSelectedPokemon }: Props) {
  const { activeDexView } = useDexContext();
  const regional = Boolean(activeDexView?.regional);

  const results = useMemo(() => {
    const matchesFilters = filterMatcher(filters);
    const matchesQuery = queryMatcher(query, regional);
    return captures.filter((capture) => held.includes(capture.pokemon.id) || (matchesFilters(capture) && matchesQuery(capture)));
  }, [captures, filters, held, query, regional]);

  // no boxes to keep to, so as wide as a row of them: the page filled, not a box's six columns down its middle
  const across = Math.min(Math.max(1, columns), MAX_BOXES_ACROSS) * BOX_COLUMNS;
  const chunks = useMemo(() => {
    const all: Capture[][] = [];
    for (let i = 0; i < results.length; i += across * CHUNK_ROWS) {
      all.push(results.slice(i, i + across * CHUNK_ROWS));
    }
    return all;
  }, [results, across]);

  if (results.length === 0) {
    return <NoResults filters={filters} query={query} setFilters={setFilters} setQuery={setQuery} />;
  }

  return (
    <div className="search-results">
      {chunks.map((chunk, c) => (
        <ResultsChunk
          captures={chunk}
          // by position: a chunk is a slice, not an identity
          columns={across}
          key={c}
          padding={c === chunks.length - 1 ? (across - (chunk.length % across)) % across : 0}
          ruled={c > 0}
          setSelectedPokemon={setSelectedPokemon}
        />
      ))}
    </div>
  );
}
