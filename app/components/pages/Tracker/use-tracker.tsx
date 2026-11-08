import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { BOX_COLUMNS, TILE_SIZE } from '../../../utils/pokemon';
import { EMPTY_METADATA } from '../../../utils/capture-fields';
import { deleteCaptures, moveCapture, progressToCaptures, writeCapture } from '../../../utils/local-data';
import { isDexPlaceId } from '../../../utils/dex-places';
import { removeEntries } from '../../../utils/free-dex';
import { locationTint, movedRecord, placeOf, samePlace } from '../../../utils/location-moves';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';

import type { Capture, Place } from '../../../types';
import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react';
import type { LocationTint } from '../../../utils/location-moves';
import type { UpdateCapturePayload } from '../../../utils/local-data';

// a checklist's check, and its Elsewhere (a mon you have that another dex represents, tinted as one checked out of
// HOME is), wear the sealed look
export function isDisplaySealed (capture: Capture, checklist: boolean): boolean {
  return checklist ? capture.status === 'caught' || capture.status === 'temporary' : capture.sealed;
}

// the slots of a grid (a box's, or a chunk of search results `columns` across) that `takes` picks, as one path: a seal
// material's clip; null with none
function slotsPath (captures: Capture[], columns: number, takes: (capture: Capture) => boolean): string | null {
  const holes = captures.reduce<string[]>((all, capture, index) => {
    if (takes(capture)) {
      const x = (index % columns) * TILE_SIZE;
      const y = Math.floor(index / columns) * TILE_SIZE;
      all.push(`M${x} ${y}h${TILE_SIZE}v${TILE_SIZE}h-${TILE_SIZE}Z`);
    }
    return all;
  }, []);
  return holes.length > 0 ? `path('${holes.join('')}')` : null;
}

// a grid's sealed slots as one path, the clip of its seal material (styles/tracker.scss) — a layer per tile exhausts
// GPU memory in a checklist; null with nothing sealed. Boxes and search results chunks both draw it, so a seal looks the
// same in every view
export function sealClip (captures: Capture[], checklist: boolean, columns = BOX_COLUMNS): string | null {
  return slotsPath(captures, columns, (capture) => isDisplaySealed(capture, checklist));
}

// a sealed tile's tint for where its mon is (utils/location-moves), when it's away from where its dex keeps them; a
// checklist's Elsewhere is tinted as a mon checked out of HOME is
export function tileTint (capture: Capture, checklist: boolean, homeDex: boolean): LocationTint | null {
  if (checklist) {
    return capture.status === 'temporary' ? 'out' : null;
  }
  return capture.sealed ? locationTint(capture.location, homeDex) : null;
}

// a grid's sealed tiles away from where its dex keeps them, a clip for each place they're in: a seal material each, laid
// over the grid's own, for a theme that draws a place's material its own way (.seal-material[data-tint]); none shows
// unless a theme does
export function sealTintClips (captures: Capture[], checklist: boolean, homeDex: boolean, columns = BOX_COLUMNS): { tint: LocationTint; clip: string }[] {
  return (['champions', 'out', 'home'] as const).flatMap((tint) => {
    const clip = slotsPath(captures, columns, (capture) => isDisplaySealed(capture, checklist) && tileTint(capture, checklist, homeDex) === tint);
    return clip ? [{ tint, clip }] : [];
  });
}

// too narrow for one box: the legacy list view; keep in sync with the 750px media queries in styles/
export const NARROW_WIDTH = 750;
const NARROW_QUERY = `(max-width: ${NARROW_WIDTH}px)`;

export function useMediaQuery (query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

// split so a captures change doesn't re-render tiles that only consume actions
interface TrackerState {
  captures: Capture[];
}

// the move menu for a sealed mon, opened beside its tile (L)
export interface MoveTarget {
  pokemon: number;
  anchor: DOMRect;
}

interface TrackerActions {
  setCaptures: Dispatch<SetStateAction<Capture[]>>;
  updateCapture: (payload: UpdateCapturePayload) => void;
  // blanks the tiles and deletes the records; sealed ones are skipped by both
  releaseCaptures: (pokemon: number[]) => void;
  // a sealed mon moved, the tile and the record alike; an unsealed one is skipped by both
  moveTo: (pokemon: number, to: Place) => void;
  openMoveMenu: (pokemon: number, anchor: Element) => void;
  // set by the one MoveMenu; read only when the menu's asked for, so opening it renders no tile
  moveMenuHost: MutableRefObject<((target: MoveTarget) => void) | null>;
  // a mon about to be brought into view (a locate): the ledger unfolds the group it's in, so there's a row to find
  revealHost: MutableRefObject<((pokemon: number) => void) | null>;
  // a mon a press just marked: kept in a filtered view it no longer matches (useHeldTiles in Dex)
  holdHost: MutableRefObject<((pokemon: number) => void) | null>;
  narrow: boolean;
}

const TrackerStateContext = createContext<TrackerState>({ captures: [] });

const TrackerActionsContext = createContext<TrackerActions>({
  setCaptures: () => {},
  updateCapture: () => {},
  releaseCaptures: () => {},
  moveTo: () => {},
  openMoveMenu: () => {},
  moveMenuHost: { current: null },
  revealHost: { current: null },
  holdHost: { current: null },
  narrow: false,
});

interface Props {
  children: ReactNode;
}

// a checklist dex named as a place in HOME isn't a save
function withoutDeletedSave (cap: Capture, saveIds: Set<string>): Capture {
  return cap.location_save && !isDexPlaceId(cap.location_save) && !saveIds.has(cap.location_save) ? { ...cap, location_save: null } : cap;
}

export const TrackerContextProvider = ({ children }: Props) => {
  const { activeDex, saves, editDexes } = useDexContext();
  const dexId = activeDex!.id;
  const free = Boolean(activeDex!.free);
  const [captures, setCaptures] = useState(() => progressToCaptures(activeDex!));
  const editRef = useRef(editDexes);
  editRef.current = editDexes;

  // a record naming a game since deleted from My Games no longer says which game it's in, so it's shown and checked as
  // unanswered (sealing, a sealed record's stale pin, the Incomplete view); storage keeps the id, as nothing outside a
  // dex edits capture data. Hidden whatever the location, so moving a record back to "In a game" can't bring it back
  const saveIds = useMemo(() => new Set(saves.map((save) => save.id)), [saves]);
  useEffect(() => {
    setCaptures((prev) => {
      let changed = false;
      const next = prev.map((cap) => {
        const shown = withoutDeletedSave(cap, saveIds);
        changed ||= shown !== cap;
        return shown;
      });
      return changed ? next : prev;
    });
  }, [saveIds]);
  // a free-form dex's mons are its entries, which its boxes change as well as its records: read again as they do
  useEffect(() => {
    if (free) {
      setCaptures(progressToCaptures(activeDex!).map((cap) => withoutDeletedSave(cap, saveIds)));
    }
  }, [activeDex]);
  const narrow = useMediaQuery(NARROW_QUERY);

  const updateCapture = useCallback((payload: UpdateCapturePayload) => writeCapture(dexId, payload), [dexId]);
  const releaseCaptures = useCallback((pokemon: number[]) => {
    // a free-form dex's released mons leave its boxes too
    if (free) {
      editRef.current((state) => removeEntries(state, dexId, pokemon));
      return;
    }
    setCaptures((prev) => prev.map((cap) => (pokemon.includes(cap.pokemon.id) && cap.captured && !cap.sealed
      ? { ...cap, ...EMPTY_METADATA, captured: false, status: null, sealed: false }
      : cap)));
    deleteCaptures(dexId, pokemon);
  }, [dexId, free]);
  const moveTo = useCallback((pokemon: number, to: Place) => {
    setCaptures((prev) => prev.map((cap) => {
      const here = placeOf(cap);
      return cap.pokemon.id === pokemon && cap.sealed && !(here && samePlace(here, to)) ? movedRecord(cap, to) : cap;
    }));
    moveCapture(dexId, pokemon, to);
  }, [dexId]);
  const moveMenuHost = useRef<((target: MoveTarget) => void) | null>(null);
  const openMoveMenu = useCallback((pokemon: number, anchor: Element) => {
    moveMenuHost.current?.({ pokemon, anchor: anchor.getBoundingClientRect() });
  }, []);

  const revealHost = useRef<((pokemon: number) => void) | null>(null);
  const holdHost = useRef<((pokemon: number) => void) | null>(null);

  const stateValue = useMemo<TrackerState>(() => ({ captures }), [captures]);
  const actionsValue = useMemo<TrackerActions>(
    () => ({ setCaptures, updateCapture, releaseCaptures, moveTo, openMoveMenu, moveMenuHost, revealHost, holdHost, narrow }),
    [updateCapture, releaseCaptures, moveTo, openMoveMenu, narrow],
  );

  return (
    <TrackerStateContext.Provider value={stateValue}>
      <TrackerActionsContext.Provider value={actionsValue}>
        {children}
      </TrackerActionsContext.Provider>
    </TrackerStateContext.Provider>
  );
};

export const useTrackerState = () => useContext(TrackerStateContext);

export const useTrackerActions = () => useContext(TrackerActionsContext);
