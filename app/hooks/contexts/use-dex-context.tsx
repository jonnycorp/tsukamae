import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { commitAppState, getAppState, loadAppState, newId, toDexView } from '../../utils/local-data';

import type { AppState, CaptureDefaults, PersonalDex } from '../../utils/local-data';
import type { Dex, GameSave } from '../../types';
import type { ReactNode } from 'react';

interface CreateDexInput {
  title: string;
  catalogKey: string;
  shiny: boolean;
  checklist?: boolean;
  captureDefaults?: CaptureDefaults;
}

interface UpdateDexInput {
  title?: string;
  shiny?: boolean;
  captureDefaults?: CaptureDefaults;
}

interface DexContextState {
  dexes: PersonalDex[] | null;
  activeDex: PersonalDex | null;
  activeDexView: Dex | null;
  setActiveDex: (id: string) => void;
  createDex: (input: CreateDexInput) => void;
  updateDex: (id: string, changes: UpdateDexInput) => void;
  deleteDex: (id: string) => void;
  moveDex: (id: string, delta: number) => void;
  saves: GameSave[];
  createSave: (input: Omit<GameSave, 'id'>) => void;
  moveSave: (id: string, delta: number) => void;
  deleteSave: (id: string) => void;
}

const DexContext = createContext<DexContextState>({
  dexes: null,
  activeDex: null,
  activeDexView: null,
  setActiveDex: () => {},
  createDex: () => {},
  updateDex: () => {},
  deleteDex: () => {},
  moveDex: () => {},
  saves: [],
  createSave: () => {},
  moveSave: () => {},
  deleteSave: () => {},
});

interface Snapshot {
  activeDexId: string;
  dexes: PersonalDex[];
  saves: GameSave[];
}

function snapshotOf (state: AppState): Snapshot {
  return { activeDexId: state.activeDexId, dexes: [...state.dexes], saves: [...(state.saves ?? [])] };
}

function moved<T> (list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  if (index === -1 || target < 0 || target >= list.length) {
    return list;
  }
  const next = [...list];
  next.splice(target, 0, ...next.splice(index, 1));
  return next;
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
      setSnapshot(snapshotOf(state));
    });
  }, []);

  const contextValue = useMemo<DexContextState>(() => {
    const apply = (mutator: (state: AppState) => void) => {
      commitAppState(mutator);
      setSnapshot(snapshotOf(getAppState()));
    };

    const activeDex = snapshot?.dexes.find((dex) => dex.id === snapshot.activeDexId) || null;

    return {
      dexes: snapshot?.dexes || null,
      activeDex,
      activeDexView: activeDex && toDexView(activeDex),
      setActiveDex: (id) => apply((state) => {
        state.activeDexId = id;
      }),
      createDex: ({ title, catalogKey, shiny, checklist, captureDefaults }) => apply((state) => {
        const dex: PersonalDex = { id: newId('dex'), title, catalogKey, shiny, checklist, progress: {}, captureDefaults };
        state.dexes = [...state.dexes, dex];
        state.activeDexId = dex.id;
      }),
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
        state.dexes = moved(state.dexes, state.dexes.findIndex((dex) => dex.id === id), delta);
      }),
      saves: snapshot?.saves || [],
      createSave: (input) => apply((state) => {
        state.saves = [...(state.saves ?? []), { id: newId('save'), ...input }];
      }),
      moveSave: (id, delta) => apply((state) => {
        const saves = state.saves ?? [];
        state.saves = moved(saves, saves.findIndex((save) => save.id === id), delta);
      }),
      // removes the list entry only; nothing outside a dex edits capture data
      deleteSave: (id) => apply((state) => {
        state.saves = (state.saves ?? []).filter((save) => save.id !== id);
      }),
    };
  }, [snapshot]);

  return (
    <DexContext.Provider value={contextValue}>
      {children}
    </DexContext.Provider>
  );
};

export const useDexContext = () => useContext(DexContext);
