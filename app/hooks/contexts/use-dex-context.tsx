import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getAppState, loadAppState, mutateAppState, newDexId, toDexView } from '../../utils/local-data';

import type { Dex } from '../../types';
import type { PersonalDex } from '../../utils/local-data';
import type { ReactNode } from 'react';

export interface CreateDexInput {
  title: string;
  catalogKey: string;
  shiny: boolean;
}

export interface UpdateDexInput {
  title?: string;
  shiny?: boolean;
}

interface DexContextState {
  // null until the persisted state has been loaded (and migrated if needed).
  dexes: PersonalDex[] | null;
  activeDex: PersonalDex | null;
  // Dex-shaped view of the active dex for the components inherited from
  // pokedextracker.com (iconClass, DexIndicator, numbering).
  activeDexView: Dex | null;
  setActiveDex: (id: string) => void;
  createDex: (input: CreateDexInput) => void;
  updateDex: (id: string, changes: UpdateDexInput) => void;
  deleteDex: (id: string) => void;
}

const DexContext = createContext<DexContextState>({
  dexes: null,
  activeDex: null,
  activeDexView: null,
  setActiveDex: () => {},
  createDex: () => {},
  updateDex: () => {},
  deleteDex: () => {},
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
      // The app always opens on the landing page — the persisted active dex
      // only tracks navigation within a session, never across launches.
      state.activeDexId = '';
      setSnapshot({ activeDexId: state.activeDexId, dexes: [...state.dexes] });
    });
  }, []);

  const contextValue = useMemo<DexContextState>(() => {
    // Runs the mutation synchronously against the in-memory state, mirrors
    // the result into React state right away, and lets the disk write settle
    // in the background (same write-behind approach as the capture hooks).
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
      createDex: ({ title, catalogKey, shiny }) => apply((state) => {
        const dex: PersonalDex = { id: newDexId(), title, catalogKey, shiny, progress: {} };
        state.dexes = [...state.dexes, dex];
        state.activeDexId = dex.id;
      }),
      updateDex: (id, changes) => apply((state) => {
        state.dexes = state.dexes.map((dex) => (dex.id === id ? { ...dex, ...changes } : dex));
      }),
      deleteDex: (id) => apply((state) => {
        state.dexes = state.dexes.filter((dex) => dex.id !== id);
        if (state.activeDexId === id) {
          // Drop back to the landing page when the open dex is deleted (also
          // how deleting your only dex works now).
          state.activeDexId = '';
        }
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
