import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { Box } from './Box';
import { COUNT_MS } from './DexMeter';
import { FlipStrips } from './FlipStrips';
import { Ledger } from './Ledger';
import { Scroll } from './Scroll';
import { SearchResults } from './SearchResults';
import { anyFilterActive, hasQuery } from './filters';
import { groupBoxes } from '../../../utils/pokemon';
import { useHotkey } from '../../../hooks/use-hotkey';
import { useThemeContext } from '../../../hooks/contexts/use-local-storage-context';
import { useTrackerActions, useTrackerState } from './use-tracker';

import type { CSSProperties } from 'react';
import type { Capture } from '../../../types';
import type { DexLayout } from './ledger-model';
import type { Dispatch, MouseEventHandler, SetStateAction } from 'react';
import type { TrackerFilters } from './filters';

interface Props {
  // boxes across the grid, once the area has been measured
  columns: number;
  // the boxes, or the ledger in their place
  layout: DexLayout;
  measured: boolean;
  filters: TrackerFilters;
  onScrollButtonClick: MouseEventHandler<HTMLDivElement>;
  query: string;
  // rows of boxes a screen shows at the scale
  rows: number;
  // the fit and the user's zoom; only the boxes scale, the search bar above never does
  scale: number;
  // the popover's tile, 0 when it's closed
  selectedPokemon: number;
  setFilters: Dispatch<SetStateAction<TrackerFilters>>;
  setQuery: Dispatch<SetStateAction<string>>;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
  showScrollButton: boolean;
}

// the boxes as they open: the screenful they open on built a box a frame, each row's flips the frame after its last
// box, then shown, faded in (.box-grid in styles/tracker.scss), once all of it is there, so it never shows half built.
// The boxes below come after it, each holding its place till then: as the dex opens, LATER_PER_FRAME a frame once
// they've waited out the header's entrance, the meter drawing in (COUNT_MS, a time, as a frame count would be shorter
// on a faster screen), so nothing of theirs competes with it; built again (a search cleared, the boxes switched back
// to), BOXES_PER_FRAME a frame straight on. All of it on the grid's one clock, so what goes in later than it was
// planned for (a row the columns regrouped, the flips back from the narrow list) goes in at its frame on that clock,
// at once where that's passed
const LATER_PER_FRAME = 1;
const BOXES_PER_FRAME = 4;

interface BuildPlan {
  // the frame a box goes in on, counted from when the grid's put in
  box: (index: number) => number;
  // the frame the boxes are shown on, which an entrance holds at till it's waited out the meter
  shown: number;
  // the frame the last row's flips go in on, where the clock stops
  last: number;
}

function buildPlan (count: number, columns: number, rows: number, entrance: boolean): BuildPlan {
  const inView = Math.max(1, Math.min(count, columns * rows));
  const first = (index: number) => 1 + index + Math.floor(index / columns);
  const shown = first(inView - 1) + 2;
  const perFrame = entrance ? LATER_PER_FRAME : BOXES_PER_FRAME;
  const box = (index: number) => (index < inView ? first(index) : shown + 1 + Math.floor((index - inView) / perFrame));
  return { box, shown, last: box(Math.max(0, count - 1)) + 1 };
}

interface GridProps {
  boxes: Capture[][];
  columns: number;
  rows: number;
  // the first boxes this dex has shown, as it opens
  entrance: boolean;
  setSelectedPokemon: Dispatch<SetStateAction<number>>;
}

function BoxGrid ({ boxes, columns, rows: rowsInView, entrance, setSelectedPokemon }: GridProps) {
  const { narrow } = useTrackerActions();
  // fixed as the grid's put in, the screenful being the one it opens on
  const [plan] = useState(() => buildPlan(boxes.length, columns, rowsInView, entrance));
  // the clock, in frames since the grid was put in. An entrance holds it at the screenful till COUNT_MS is up, or till
  // the screenful changes (a zoom, the window resized: what's come into it would wait out the meter)
  const [frame, setFrame] = useState(0);
  const [waited, setWaited] = useState(!entrance);
  useEffect(() => {
    if (waited) {
      return undefined;
    }
    const timer = window.setTimeout(() => setWaited(true), COUNT_MS);
    return () => window.clearTimeout(timer);
  }, [waited]);
  const [screenful] = useState(() => columns * rowsInView);
  useEffect(() => {
    if (columns * rowsInView !== screenful) {
      setWaited(true);
    }
  }, [columns, rowsInView]);
  useEffect(() => {
    if (frame >= plan.last || (!waited && frame >= plan.shown)) {
      return undefined;
    }
    const id = window.requestAnimationFrame(() => setFrame(frame + 1));
    return () => window.cancelAnimationFrame(id);
  }, [frame, waited]);

  // each row of boxes shares its flips' overlay
  const rows = useMemo(() => {
    const all: Capture[][][] = [];
    for (let i = 0; i < boxes.length; i += columns) {
      all.push(boxes.slice(i, i + columns));
    }
    return all;
  }, [boxes, columns]);

  // building while the clock runs, which a mon looked for waits out (Tracker's handleLocate)
  return (
    <div className="box-grid" data-building={frame < plan.last || undefined} data-hidden={frame < plan.shown || undefined}>
      {boxes.map((box, i) => (frame >= plan.box(i)
        ? <Box captures={box} deferFrames={0} key={box[0].pokemon.id} setSelectedPokemon={setSelectedPokemon} />
        // its place held till then (the narrow list's rows have no fixed size to hold)
        : !narrow && <div aria-hidden="true" className="box box-placeholder" key={box[0].pokemon.id} />))}
      {/* keyed by position, so a change of columns regroups the strips without restarting them; a row's the frame
          after its last box, with the columns as they are now */}
      {!narrow && rows.map((row, r) => frame > plan.box(Math.min(boxes.length, (r + 1) * columns) - 1) &&
        <FlipStrips grids={row} key={r} row={r} />)}
    </div>
  );
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
  layout,
  measured,
  filters,
  onScrollButtonClick,
  query,
  rows,
  scale,
  selectedPokemon,
  setFilters,
  setQuery,
  setSelectedPokemon,
  showScrollButton,
}: Props) {
  const { captures } = useTrackerState();
  const { releaseCaptures, openMoveMenu } = useTrackerActions();

  const boxes = useMemo(() => groupBoxes(captures), [captures]);

  // L over a sealed tile (or a sealed mon's ledger row): where it can be moved, in a menu beside it (MoveMenu)
  useHotkey('l', () => {
    const tile = document.querySelector<HTMLElement>(':is(.pokemon, .ledger-row).sealed[data-pokemon-id]:hover');
    const id = Number(tile?.dataset.pokemonId);
    const capture = captures.find((cap) => cap.pokemon.id === id);
    if (!tile || !capture?.sealed || tile.classList.contains('checklist')) {
      return;
    }
    openMoveMenu(id, tile);
  });

  useHotkey('d', () => {
    const tile = document.querySelector<HTMLElement>(':is(.pokemon, .ledger-row)[data-pokemon-id]:hover');
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

  // the boxes shown as the dex opens are its entrance, the header drawing in alongside (BoxGrid). Once it's open (on
  // the boxes or on the list) no showing is: a search cleared, the boxes switched to from the list. Nor is any in still
  // mode, where the header doesn't draw in
  const { still } = useThemeContext();
  const opened = useRef(false);
  useEffect(() => {
    if (measured) {
      opened.current = true;
    }
  }, [measured]);
  const showsBoxes = layout === 'boxes' && measured && !hasQuery(deferredQuery) && !anyFilterActive(deferredFilters);

  return (
    <>
      {/* outside the zoom, so it's the same size at every scale */}
      <Scroll onClick={onScrollButtonClick} showScroll={showScrollButton} />
      {/* --dex-px: a screen pixel in the dex's own px, for lines and halos that stay that fine at any zoom. Stale while
          what's on screen is still the last view, the new filters or search rendering behind it (a page handing the
          dex a view waits that out, Tracker's handOff) */}
      <div
        className="dex"
        data-stale={(deferredFilters !== filters || deferredQuery !== query) || undefined}
        style={{ zoom: scale, '--dex-px': `${1 / (scale * window.devicePixelRatio)}px` } as CSSProperties}
      >
        <div className="wrapper">
          {layout === 'ledger' &&
            <Ledger
              captures={captures}
              filters={deferredFilters}
              held={held}
              query={deferredQuery}
              setFilters={setFilters}
              setQuery={setQuery}
              setSelectedPokemon={setSelectedPokemon}
            />
          }
          {layout === 'boxes' && (hasQuery(deferredQuery) || anyFilterActive(deferredFilters)) &&
            <SearchResults
              captures={captures}
              columns={columns}
              filters={deferredFilters}
              held={held}
              query={deferredQuery}
              setFilters={setFilters}
              setQuery={setQuery}
              setSelectedPokemon={setSelectedPokemon}
            />
          }
          {/* only once the area's measured, so the plan is the screenful that shows */}
          {showsBoxes &&
            <BoxGrid boxes={boxes} columns={columns} entrance={!opened.current && !still} rows={rows} setSelectedPokemon={setSelectedPokemon} />
          }
        </div>
      </div>
    </>
  );
}
