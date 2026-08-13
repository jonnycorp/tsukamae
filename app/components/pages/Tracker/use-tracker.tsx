import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { TESTING } from '../../../utils/testing';
import { isRecordComplete } from '../../../utils/capture-fields';
import { useDexContext } from '../../../hooks/contexts/use-dex-context';
import { useDeleteCapture, useUpdateCapture } from '../../../hooks/queries/captures';

import type { Capture } from '../../../types';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import type { TranslationKey } from '../../../i18n/translations';
import type { UpdateCapturePayload } from '../../../hooks/queries/captures';

export type UICapture = Capture;

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

export function matchesFilters (capture: UICapture, filters: TrackerFilters): boolean {
  if (filters.hideMarked && capture.captured) {
    return false;
  }
  if (filters.temporaryOnly && capture.status !== 'temporary') {
    return false;
  }
  // unmarked slots aren't work in progress
  if (filters.unsealedOnly && (!capture.captured || capture.sealed)) {
    return false;
  }
  if (filters.incompleteOnly && (!capture.captured || capture.sealed || isRecordComplete(capture))) {
    return false;
  }
  if (filters.favoritesOnly && capture.favorite !== 'favorite' && capture.favorite !== 'partner') {
    return false;
  }
  return true;
}

// split contexts: a captures change must not re-render tiles that only consume actions
interface TrackerState {
  captures: UICapture[];
}

interface TrackerActions {
  setCaptures: Dispatch<SetStateAction<UICapture[]>>;
  updateCapture: (payload: UpdateCapturePayload) => void;
  deleteCaptures: (pokemon: number[]) => void;
  // TESTING only: render-time kill switch for the sealed visuals; never touches data
  sealFx: boolean;
  setSealFx: Dispatch<SetStateAction<boolean>>;
}

const TrackerStateContext = createContext<TrackerState>({ captures: [] });

const TrackerActionsContext = createContext<TrackerActions>({
  setCaptures: () => {},
  updateCapture: () => {},
  deleteCaptures: () => {},
  sealFx: true,
  setSealFx: () => {},
});

interface Props {
  children: ReactNode;
}

export const TrackerContextProvider = ({ children }: Props) => {
  const { activeDex } = useDexContext();
  const [captures, setCaptures] = useState<UICapture[]>([]);
  const [sealFx, setSealFx] = useState(true);

  // one shared mutation instead of one observer per tile
  const { mutate } = useUpdateCapture(activeDex!.id, TESTING && !sealFx);
  const updateCapture = useCallback((payload: UpdateCapturePayload) => mutate({ payload }), [mutate]);
  const { mutate: deleteMutate } = useDeleteCapture(activeDex!.id);
  const deleteCaptures = useCallback((pokemon: number[]) => deleteMutate({ payload: { pokemon } }), [deleteMutate]);

  const stateValue = useMemo<TrackerState>(() => ({ captures }), [captures]);
  const actionsValue = useMemo<TrackerActions>(
    () => ({ setCaptures, updateCapture, deleteCaptures, sealFx, setSealFx }),
    [updateCapture, deleteCaptures, sealFx],
  );

  return (
    <TrackerStateContext.Provider value={stateValue}>
      <TrackerActionsContext.Provider value={actionsValue}>
        {children}
      </TrackerActionsContext.Provider>
    </TrackerStateContext.Provider>
  );
};

export const useTrackerState = () => {
  return useContext(TrackerStateContext);
};

export const useTrackerActions = () => {
  return useContext(TrackerActionsContext);
};
