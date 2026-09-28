import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { TESTING } from '../../../utils/testing';
import { deleteCaptures as deleteStoredCaptures, progressToCaptures, writeCapture } from '../../../utils/local-data';
import { isRecordComplete } from '../../../utils/capture-fields';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';

import type { Capture } from '../../../types';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { TranslationKey } from '../../../i18n/translations';
import type { UpdateCapturePayload } from '../../../utils/local-data';

export function isDisplaySealed (capture: Capture, checklist: boolean, sealFx: boolean): boolean {
  return sealFx && (checklist ? capture.captured : capture.sealed);
}

export interface TrackerFilters {
  hideMarked: boolean;
  temporaryOnly: boolean;
  unsealedOnly: boolean;
  incompleteOnly: boolean;
  favoritesOnly: boolean;
}

export const EMPTY_FILTERS: TrackerFilters = {
  hideMarked: false,
  temporaryOnly: false,
  unsealedOnly: false,
  incompleteOnly: false,
  favoritesOnly: false,
};

export const FILTER_META: { id: keyof TrackerFilters; labelKey: TranslationKey }[] = [
  { id: 'hideMarked', labelKey: 'search.hideMarked' },
  { id: 'temporaryOnly', labelKey: 'search.temporaryOnly' },
  { id: 'unsealedOnly', labelKey: 'search.unsealedOnly' },
  { id: 'incompleteOnly', labelKey: 'search.incompleteOnly' },
  { id: 'favoritesOnly', labelKey: 'search.favoritesOnly' },
];

export function anyFilterActive (filters: TrackerFilters): boolean {
  return FILTER_META.some((meta) => filters[meta.id]);
}

export function matchesFilters (capture: Capture, filters: TrackerFilters): boolean {
  if (filters.hideMarked && capture.captured) {
    return false;
  }
  if (filters.temporaryOnly && capture.status !== 'temporary') {
    return false;
  }
  if (filters.unsealedOnly && (!capture.captured || capture.sealed)) {
    return false;
  }
  if (filters.incompleteOnly && (!capture.captured || capture.sealed ||
    capture.status === 'unobtainable' || isRecordComplete(capture))) {
    return false;
  }
  if (filters.favoritesOnly && capture.favorite !== 'favorite' && capture.favorite !== 'partner') {
    return false;
  }
  return true;
}

const NARROW_QUERY = '(max-width: 750px)';

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
  deleteCaptures: (pokemon: number[]) => void;
  sealFx: boolean;
  setSealFx: Dispatch<SetStateAction<boolean>>;
  narrow: boolean;
}

const TrackerStateContext = createContext<TrackerState>({ captures: [] });

const TrackerActionsContext = createContext<TrackerActions>({
  setCaptures: () => {},
  updateCapture: () => {},
  deleteCaptures: () => {},
  sealFx: true,
  setSealFx: () => {},
  narrow: false,
});

interface Props {
  children: ReactNode;
}

export const TrackerContextProvider = ({ children }: Props) => {
  const { activeDex } = useDexContext();
  const dexId = activeDex!.id;
  const [captures, setCaptures] = useState(() => progressToCaptures(activeDex!));
  const [sealFx, setSealFx] = useState(true);
  const narrow = useMediaQuery(NARROW_QUERY);

  const updateCapture = useCallback(
    (payload: UpdateCapturePayload) => writeCapture(dexId, payload, TESTING && !sealFx),
    [dexId, sealFx],
  );
  const deleteCaptures = useCallback((pokemon: number[]) => deleteStoredCaptures(dexId, pokemon), [dexId]);

  const stateValue = useMemo<TrackerState>(() => ({ captures }), [captures]);
  const actionsValue = useMemo<TrackerActions>(
    () => ({ setCaptures, updateCapture, deleteCaptures, sealFx, setSealFx, narrow }),
    [updateCapture, deleteCaptures, sealFx, narrow],
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
