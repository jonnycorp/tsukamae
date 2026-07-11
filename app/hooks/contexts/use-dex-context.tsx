import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getAppState, loadAppState, mutateAppState, newDexId, toDexView } from '../../utils/local-data';

import type { CaptureDefaults, PersonalDex } from '../../utils/local-data';
import type { Dex } from '../../types';
import type { ReactNode } from 'react';

export interface CreateDexInput {
  title: string;
  catalogKey: string;
  shiny: boolean;
  captureDefaults?: CaptureDefaults;
}

export interface UpdateDexInput {
  title?: string;
  shiny?: boolean;
  captureDefaults?: CaptureDefaults;
}

interface DexContextState {
  // null until the persisted state has been loaded (and migrated if needed).
  dexes: PersonalDex[] | null;
  activeDex: PersonalDex | null;
  activeDexView: Dex | null;
  setActiveDex: (id: string) => void;
  // Returns the dex so callers can seed caches before the view switch.
  createDex: (input: CreateDexInput) => PersonalDex;
  updateDex: (id: string, changes: UpdateDexInput) => void;
  deleteDex: (id: string) => void;
  // Shift a dex up (-1) or down (+1) in the landing-page list order.
  moveDex: (id: string, delta: number) => void;
}

const DexContext = createContext<DexContextState>({
  dexes: null,
  activeDex: null,
  activeDexView: null,
  setActiveDex: () => {},
  createDex: () => {
    throw new Error('createDex called outside DexContextProvider');
  },
  updateDex: () => {},
  deleteDex: () => {},
  moveDex: () => {},
});

interface Snapshot {
  activeDexId: string;
  dexes: PersonalDex[];
}

interface Props {
  children: ReactNode;
}

export const DexContextProvider = ({ children }: Props) => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    loadAppState().then((state) => {
      // Always open on the landing page; activeDexId persists only within a session.
      state.activeDexId = '';
      setSnapshot({ activeDexId: state.activeDexId, dexes: [...state.dexes] });
    });
  }, []);

  const contextValue = useMemo<DexContextState>(() => {
    // Mutates in-memory state synchronously; the disk write settles in the background.
    const apply = (mutator: Parameters<typeof mutateAppState>[0]) => {
      // eslint-disable-next-line no-console
      mutateAppState(mutator).catch((err) => console.error('failed to save dexes:', err));
      const state = getAppState();
      setSnapshot({ activeDexId: state.activeDexId, dexes: [...state.dexes] });
    };

    const activeDex = snapshot?.dexes.find((dex) => dex.id === snapshot.activeDexId) || null;

    return {
      dexes: snapshot?.dexes || null,
      activeDex,
      activeDexView: activeDex && toDexView(activeDex),
      setActiveDex: (id) => apply((state) => {
        state.activeDexId = id;
      }),
      createDex: ({ title, catalogKey, shiny, captureDefaults }) => {
        const dex: PersonalDex = { id: newDexId(), title, catalogKey, shiny, progress: {}, captureDefaults };
        apply((state) => {
          state.dexes = [...state.dexes, dex];
          state.activeDexId = dex.id;
        });
        return dex;
      },
      updateDex: (id, changes) => apply((state) => {
        state.dexes = state.dexes.map((dex) => (dex.id === id ? { ...dex, ...changes } : dex));
      }),
      deleteDex: (id) => apply((state) => {
        state.dexes = state.dexes.filter((dex) => dex.id !== id);
        if (state.activeDexId === id) {
          state.activeDexId = '';
        }
      }),
      moveDex: (id, delta) => apply((state) => {
        const index = state.dexes.findIndex((dex) => dex.id === id);
        const target = index + delta;
        if (index === -1 || target < 0 || target >= state.dexes.length) {
          return;
        }
        const dexes = [...state.dexes];
        const [moved] = dexes.splice(index, 1);
        dexes.splice(target, 0, moved);
        state.dexes = dexes;
      }),
    };
  }, [snapshot]);

  return (
    <DexContext.Provider value={contextValue}>
      {children}
    </DexContext.Provider>
  );
};

export const useDexContext = () => {
  return useContext(DexContext);
};
