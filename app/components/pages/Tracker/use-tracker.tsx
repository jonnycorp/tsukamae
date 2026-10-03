import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { BOX_COLUMNS, TILE_SIZE } from '../../../utils/pokemon';
import { TESTING } from '../../../utils/testing';
import { EMPTY_METADATA } from '../../../utils/capture-fields';
import { deleteCaptures, progressToCaptures, writeCapture } from '../../../utils/local-data';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';

import type { Capture } from '../../../types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { UpdateCapturePayload } from '../../../utils/local-data';

export function isDisplaySealed (capture: Capture, checklist: boolean, sealFx: boolean): boolean {
  return sealFx && (checklist ? capture.status === 'caught' : capture.sealed);
}

// a box-sized grid's shine, one band clipped to its sealed slots — a per-tile shine layer exhausts GPU memory in a
// checklist; null with nothing sealed. Boxes and search results chunks both draw it, so a seal shines in every view
export function shineClip (captures: Capture[], checklist: boolean, sealFx: boolean): string | null {
  const holes = captures.reduce<string[]>((all, capture, index) => {
    if (isDisplaySealed(capture, checklist, sealFx)) {
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

function useMediaQuery (query: string): boolean {
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

interface TrackerActions {
  setCaptures: Dispatch<SetStateAction<Capture[]>>;
  updateCapture: (payload: UpdateCapturePayload) => void;
  // blanks the tiles and deletes the records; sealed ones are skipped by both
  releaseCaptures: (pokemon: number[]) => void;
  sealFx: boolean;
  setSealFx: Dispatch<SetStateAction<boolean>>;
  narrow: boolean;
}

const TrackerStateContext = createContext<TrackerState>({ captures: [] });

const TrackerActionsContext = createContext<TrackerActions>({
  setCaptures: () => {},
  updateCapture: () => {},
  releaseCaptures: () => {},
  sealFx: true,
  setSealFx: () => {},
  narrow: false,
});

interface Props {
  children: ReactNode;
}

export const TrackerContextProvider = ({ children }: Props) => {
  const { activeDex, saves } = useDexContext();
  const dexId = activeDex!.id;
  const [captures, setCaptures] = useState(() => progressToCaptures(activeDex!));

  // a record naming a game since deleted from My Games no longer says which game it's in, so it's shown and checked as
  // unanswered (sealing, a sealed record's stale pin, the Incomplete view); storage keeps the id, as nothing outside a
  // dex edits capture data. Hidden whatever the location, so moving a record back to "In a game" can't bring it back
  useEffect(() => {
    const ids = new Set(saves.map((save) => save.id));
    setCaptures((prev) => {
      let changed = false;
      const next = prev.map((cap) => {
        if (cap.location_save && !ids.has(cap.location_save)) {
          changed = true;
          return { ...cap, location_save: null };
        }
        return cap;
      });
      return changed ? next : prev;
    });
  }, [saves]);
  const [sealFx, setSealFx] = useState(true);
  const narrow = useMediaQuery(NARROW_QUERY);

  const updateCapture = useCallback(
    (payload: UpdateCapturePayload) => writeCapture(dexId, payload, TESTING && !sealFx),
    [dexId, sealFx],
  );
  const releaseCaptures = useCallback((pokemon: number[]) => {
    setCaptures((prev) => prev.map((cap) => (pokemon.includes(cap.pokemon.id) && cap.captured && !cap.sealed
      ? { ...cap, ...EMPTY_METADATA, captured: false, status: null, sealed: false }
      : cap)));
    deleteCaptures(dexId, pokemon);
  }, [dexId]);

  const stateValue = useMemo<TrackerState>(() => ({ captures }), [captures]);
  const actionsValue = useMemo<TrackerActions>(
    () => ({ setCaptures, updateCapture, releaseCaptures, sealFx, setSealFx, narrow }),
    [updateCapture, releaseCaptures, sealFx, narrow],
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
