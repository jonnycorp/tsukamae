import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { BOX_COLUMNS, TILE_SIZE } from '../../../utils/pokemon';
import { EMPTY_METADATA } from '../../../utils/capture-fields';
import { deleteCaptures, moveCapture, progressToCaptures, subscribeHistory, writeCapture } from '../../../utils/local-data';
import { movedRecord, placeOf, samePlace } from '../../../utils/location-moves';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';

import type { Capture, Place } from '../../../types';
import type { Dispatch, MutableRefObject, ReactNode, SetStateAction } from 'react';
import type { UpdateCapturePayload } from '../../../utils/local-data';

export function isDisplaySealed (capture: Capture, checklist: boolean): boolean {
  return checklist ? capture.status === 'caught' : capture.sealed;
}

// a box-sized grid's shine, one band clipped to its sealed slots — a per-tile shine layer exhausts GPU memory in a
// checklist; null with nothing sealed. Boxes and search results chunks both draw it, so a seal shines in every view
export function shineClip (captures: Capture[], checklist: boolean): string | null {
  const holes = captures.reduce<string[]>((all, capture, index) => {
    if (isDisplaySealed(capture, checklist)) {
      const x = (index % BOX_COLUMNS) * TILE_SIZE;
      const y = Math.floor(index / BOX_COLUMNS) * TILE_SIZE;
      all.push(`M${x} ${y}h${TILE_SIZE}v${TILE_SIZE}h-${TILE_SIZE}Z`);
    }
    return all;
  }, []);
  return holes.length > 0 ? `path('${holes.join('')}')` : null;
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
  narrow: false,
});

interface Props {
  children: ReactNode;
}

function withoutDeletedSave (cap: Capture, saveIds: Set<string>): Capture {
  return cap.location_save && !saveIds.has(cap.location_save) ? { ...cap, location_save: null } : cap;
}

export const TrackerContextProvider = ({ children }: Props) => {
  const { activeDex, saves } = useDexContext();
  const dexId = activeDex!.id;
  const [captures, setCaptures] = useState(() => progressToCaptures(activeDex!));

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
  const narrow = useMediaQuery(NARROW_QUERY);

  // a step undone or redone (Ctrl+Z) put records back in storage; the tiles take them as they now are, as a dex's
  // captures are first read (progressToCaptures), a deleted game hidden as above
  useEffect(() => subscribeHistory((step, direction) => {
    if (step.dexId !== dexId) {
      return;
    }
    const records = direction === 'undo' ? step.before : step.after;
    setCaptures((prev) => prev.map((cap) => {
      const key = String(cap.pokemon.id);
      if (!(key in records)) {
        return cap;
      }
      const entry = records[key];
      return entry
        ? withoutDeletedSave({ ...EMPTY_METADATA, ...entry, pokemon: cap.pokemon, captured: true, status: entry.status, sealed: Boolean(entry.sealed) }, saveIds)
        : { ...EMPTY_METADATA, pokemon: cap.pokemon, captured: false, status: null, sealed: false };
    }));
  }), [dexId, saveIds]);

  const updateCapture = useCallback((payload: UpdateCapturePayload) => writeCapture(dexId, payload), [dexId]);
  const releaseCaptures = useCallback((pokemon: number[]) => {
    setCaptures((prev) => prev.map((cap) => (pokemon.includes(cap.pokemon.id) && cap.captured && !cap.sealed
      ? { ...cap, ...EMPTY_METADATA, captured: false, status: null, sealed: false }
      : cap)));
    deleteCaptures(dexId, pokemon);
  }, [dexId]);
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

  const stateValue = useMemo<TrackerState>(() => ({ captures }), [captures]);
  const actionsValue = useMemo<TrackerActions>(
    () => ({ setCaptures, updateCapture, releaseCaptures, moveTo, openMoveMenu, moveMenuHost, revealHost, narrow }),
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
