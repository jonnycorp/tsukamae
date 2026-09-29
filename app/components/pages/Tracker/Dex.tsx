import { useDeferredValue, useMemo, useState } from 'react';

import { Box } from './Box';
import { FlipStrips } from './FlipStrips';
import { Scroll } from './Scroll';
import { SearchResults } from './SearchResults';
import { anyFilterActive, hasQuery } from './filters';
import { groupBoxes } from '../../../utils/pokemon';
import { useHotkey } from '../../../hooks/use-hotkey';
import { useTrackerActions, useTrackerState } from './use-tracker';

import type { Capture } from '../../../types';
import type { Dispatch, MouseEventHandler, SetStateAction } from 'react';
import type { TrackerFilters } from './filters';

interface Props {
  // boxes across the grid, once the area has been measured
  columns: number;
  measured: boolean;
  filters: TrackerFilters;
  onScrollButtonClick: MouseEventHandler<HTMLDivElement>;
  query: string;
  // the fit and the user's zoom; only the boxes scale, the search bar above never does
  scale: number;
  // the popover's tile, 0 when it's closed
  selectedPokemon: number;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
  showScrollButton: boolean;
}

// the tiles the popover has worked on since it opened stay in a filtered view after an edit takes them out of it
// (marked in Missing, finished in Incomplete), until it closes or the view itself changes; adjusted while rendering, so
// a tile marked in Missing is still there when the popover first docks to it
function useHeldTiles (selected: number, filters: TrackerFilters, query: string): number[] {
  const [hold, setHold] = useState({ selected: 0, filters, query, ids: [] as number[] });
  if (hold.selected !== selected || hold.filters !== filters || hold.query !== query) {
    const kept = selected !== 0 && hold.filters === filters && hold.query === query ? hold.ids : [];
    const added = selected !== 0 && hold.selected !== selected && !kept.includes(selected);
    setHold({ selected, filters, query, ids: added ? [...kept, selected] : kept });
  }
  return hold.ids;
}

export function Dex ({
  columns,
  measured,
  filters,
  onScrollButtonClick,
  query,
  scale,
  selectedPokemon,
  setFilters,
  setQuery,
  setSelectedPokemon,
  showScrollButton,
}: Props) {
  const { captures } = useTrackerState();
  const { releaseCaptures, narrow } = useTrackerActions();

  const boxes = useMemo(() => groupBoxes(captures), [captures]);
  // each row of boxes shares its flips' overlay
  const rows = useMemo(() => {
    const all: Capture[][][] = [];
    for (let i = 0; i < boxes.length; i += columns) {
      all.push(boxes.slice(i, i + columns));
    }
    return all;
  }, [boxes, columns]);

  useHotkey('d', () => {
    const tile = document.querySelector<HTMLElement>('.pokemon[data-pokemon-id]:hover');
    const id = Number(tile?.dataset.pokemonId);
    const capture = captures.find((cap) => cap.pokemon.id === id);
    if (!capture?.captured || capture.sealed) {
      return;
    }
    releaseCaptures([id]);
    setSelectedPokemon((current) => (current === id ? 0 : current));
  });

  const deferredQuery = useDeferredValue(query);
  const deferredFilters = useDeferredValue(filters);
  // against the view on screen, so switching views drops them only as the new one renders
  const held = useHeldTiles(selectedPokemon, deferredFilters, deferredQuery);

  return (
    <>
      {/* outside the zoom, so it's the same size at every scale */}
      <Scroll onClick={onScrollButtonClick} showScroll={showScrollButton} />
      <div className="dex" style={{ zoom: scale }}>
        <div className="wrapper">
          {hasQuery(deferredQuery) || anyFilterActive(deferredFilters) ?
            <SearchResults
              captures={captures}
              filters={deferredFilters}
              held={held}
              query={deferredQuery}
              setFilters={setFilters}
              setQuery={setQuery}
              setSelectedPokemon={setSelectedPokemon}
            /> :
            <div className="box-grid">
              {boxes.map((box, i) => (
                <Box
                  captures={box}
                  deferred={i > 1}
                  key={box[0].pokemon.id}
                  setSelectedPokemon={setSelectedPokemon}
                />
              ))}
              {/* keyed by position, so a change of columns regroups the strips without restarting them; only once the
                  columns are measured, so a row's deferral matches its boxes' */}
              {!narrow && measured && rows.map((row, r) => <FlipStrips deferred={(r + 1) * columns > 2} grids={row} key={r} row={r} />)}
            </div>
          }
        </div>
      </div>
    </>
  );
}
