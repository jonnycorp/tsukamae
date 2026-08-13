import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { getAppState, loadAppState, mutateAppState, newDexId, newSaveId, toDexView } from '../../utils/local-data';

import type { CaptureDefaults, PersonalDex } from '../../utils/local-data';
import type { Dex, GameSave } from '../../types';
import type { ReactNode } from 'react';

export interface CreateDexInput {
  title: string;
  catalogKey: string;
  shiny: boolean;
  checklist?: boolean;
  captureDefaults?: CaptureDefaults;
}

export interface UpdateDexInput {
  title?: string;
  shiny?: boolean;
  captureDefaults?: CaptureDefaults;
}

interface DexContextState {
  // null until the persisted state has loaded
  dexes: PersonalDex[] | null;
  activeDex: PersonalDex | null;
  activeDexView: Dex | null;
  setActiveDex: (id: string) => void;
  // returns the dex so callers can seed caches before the view switch
  createDex: (input: CreateDexInput) => PersonalDex;
  updateDex: (id: string, changes: UpdateDexInput) => void;
  deleteDex: (id: string) => void;
  // shift a dex up (-1) or down (+1) in the landing list
  moveDex: (id: string, delta: number) => void;
  // playthroughs are global, not per-dex
  saves: GameSave[];
  createSave: (input: Omit<GameSave, 'id'>) => void;
  moveSave: (id: string, delta: number) => void;
  deleteSave: (id: string) => void;
  // re-snapshot after writes that bypass this context
  refreshDexes: () => void;
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
  saves: [],
  createSave: () => {},
  moveSave: () => {},
  deleteSave: () => {},
  refreshDexes: () => {},
});

interface Snapshot {
  activeDexId: string;
  dexes: PersonalDex[];
  saves: GameSave[];
}

interface Props {
  children: ReactNode;
}

export const DexContextProvider = ({ children }: Props) => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    loadAppState().then((state) => {
      // always open on the landing page
      state.activeDexId = '';
      setSnapshot({ activeDexId: state.activeDexId, dexes: [...state.dexes], saves: [...(state.saves ?? [])] });
    });
  }, []);

  const contextValue = useMemo<DexContextState>(() => {
    // mutates in memory synchronously; the disk write settles in the background
    const apply = (mutator: Parameters<typeof mutateAppState>[0]) => {
      // eslint-disable-next-line no-console
      mutateAppState(mutator).catch((err) => console.error('failed to save dexes:', err));
      const state = getAppState();
      setSnapshot({ activeDexId: state.activeDexId, dexes: [...state.dexes], saves: [...(state.saves ?? [])] });
    };

    const activeDex = snapshot?.dexes.find((dex) => dex.id === snapshot.activeDexId) || null;

    return {
      dexes: snapshot?.dexes || null,
      activeDex,
      activeDexView: activeDex && toDexView(activeDex),
      setActiveDex: (id) => apply((state) => {
        state.activeDexId = id;
      }),
      createDex: ({ title, catalogKey, shiny, checklist, captureDefaults }) => {
        const dex: PersonalDex = { id: newDexId(), title, catalogKey, shiny, checklist, progress: {}, captureDefaults };
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
      saves: snapshot?.saves || [],
      createSave: (input) => apply((state) => {
        state.saves = [...(state.saves ?? []), { id: newSaveId(), ...input }];
      }),
      moveSave: (id, delta) => apply((state) => {
        const saves = [...(state.saves ?? [])];
        const index = saves.findIndex((save) => save.id === id);
        const target = index + delta;
        if (index === -1 || target < 0 || target >= saves.length) {
          return;
        }
        const [moved] = saves.splice(index, 1);
        saves.splice(target, 0, moved);
        state.saves = saves;
      }),
      // removes the list entry only — nothing outside a dex edits capture data
      deleteSave: (id) => apply((state) => {
        state.saves = (state.saves ?? []).filter((save) => save.id !== id);
      }),
      refreshDexes: () => {
        const state = getAppState();
        setSnapshot({ activeDexId: state.activeDexId, dexes: [...state.dexes], saves: [...(state.saves ?? [])] });
      },
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
