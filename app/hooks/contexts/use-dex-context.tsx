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
  // the saved data couldn't be read; nothing is loaded and nothing is saved
  loadFailed: boolean;
  activeDex: PersonalDex | null;
  activeDexView: Dex | null;
  setActiveDex: (id: string) => void;
  createDex: (input: CreateDexInput) => void;
  updateDex: (id: string, changes: UpdateDexInput) => void;
  deleteDex: (id: string) => void;
  moveDex: (id: string, delta: number) => void;
  saves: GameSave[];
  createSave: (input: Omit<GameSave, 'id'>) => void;
  updateSave: (id: string, changes: Omit<GameSave, 'id'>) => void;
  moveSave: (id: string, delta: number) => void;
  deleteSave: (id: string) => void;
}

const DexContext = createContext<DexContextState>({
  dexes: null,
  loadFailed: false,
  activeDex: null,
  activeDexView: null,
  setActiveDex: () => {},
  createDex: () => {},
  updateDex: () => {},
  deleteDex: () => {},
  moveDex: () => {},
  saves: [],
  createSave: () => {},
  updateSave: () => {},
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
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    loadAppState().then((state) => {
      // always open on the landing page
      state.activeDexId = '';
      setSnapshot(snapshotOf(state));
    }, (err) => {
      // eslint-disable-next-line no-console
      console.error('failed to load:', err);
      setLoadFailed(true);
    });
  }, []);

  const contextValue = useMemo<DexContextState>(() => {
    const apply = (mutator: (state: AppState) => void) => {
      // nothing's loaded before the data is read, or when it couldn't be, and nothing may be saved over that file
      if (!snapshot) {
        return;
      }
      commitAppState(mutator);
      setSnapshot(snapshotOf(getAppState()));
    };

    const activeDex = snapshot?.dexes.find((dex) => dex.id === snapshot.activeDexId) || null;

    return {
      dexes: snapshot?.dexes || null,
      loadFailed,
      activeDex,
      activeDexView: activeDex && toDexView(activeDex),
      // in memory only: every launch opens on the landing page, so switching dex was never worth a write. It goes on the
      // live state too, which the next real change rebuilds the snapshot from
      setActiveDex: (id) => {
        if (!snapshot || snapshot.activeDexId === id) {
          return;
        }
        getAppState().activeDexId = id;
        setSnapshot({ ...snapshot, activeDexId: id });
      },
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
      // in place, keeping the id every "in a game" location points at; records keep the OT they were stamped with
      updateSave: (id, changes) => apply((state) => {
        state.saves = (state.saves ?? []).map((save) => (save.id === id ? { ...save, ...changes } : save));
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
  }, [snapshot, loadFailed]);

  return (
    <DexContext.Provider value={contextValue}>
      {children}
    </DexContext.Provider>
  );
};

export const useDexContext = () => useContext(DexContext);
