import { useMutation, useQuery } from '@tanstack/react-query';

import { EMPTY_METADATA, genderFromLock, lookupOT, metadataFromDefaults } from '../../utils/capture-fields';
import { getCatalogDex, loadAppState, mutateAppState, progressToCaptures } from '../../utils/local-data';

import type { AppState, CaptureDefaults, CatalogDex, PersonalDex, ProgressEntry } from '../../utils/local-data';
import type { Capture, CaptureMetadata, CaptureStatus, GameSave } from '../../types';
import type { UseQueryOptions } from '@tanstack/react-query';

export enum QueryKey {
  ListCaptures = 'ListCaptures',
}

type ListCapturesData = Capture[];

function findDex (state: AppState, dexId: string): PersonalDex {
  const dex = state.dexes.find((entry) => entry.id === dexId);
  if (!dex) {
    throw new Error(`unknown dex id ${dexId}`);
  }
  return dex;
}

// per-dex prefills for a new entry, walked from the registry
function newEntryMetadata (defaults: CaptureDefaults | undefined, saves: GameSave[], catalog: CatalogDex, pokemonId: number): CaptureMetadata {
  const meta: CaptureMetadata = { ...EMPTY_METADATA, ...metadataFromDefaults(defaults) };
  // OT comes solely from the matching save; no match leaves it blank
  meta.ot = lookupOT(saves, meta.origin_game, meta.language);
  // location derives from the dex, never from stored defaults
  meta.location = catalog.game.id === 'home' ? 'home' : 'game';
  meta.location_save = null;
  // a species gender lock is a fact, not a guess — mixed species stay blank
  meta.gender = genderFromLock(catalog.pokemonList.find((mon) => mon.id === pokemonId)?.gender_lock);
  return meta;
}

export const useCaptures = (dexId: string, options: UseQueryOptions<ListCapturesData, Error> = {}) => {
  return useQuery<ListCapturesData, Error, ListCapturesData>({
    ...options,
    queryKey: [QueryKey.ListCaptures, dexId],
    queryFn: async () => {
      const state = await loadAppState();
      return progressToCaptures(findDex(state, dexId));
    },
  });
};

export interface DeleteCapturesPayload {
  pokemon: number[];
}

interface DeleteCaptureMutationVariables {
  payload: DeleteCapturesPayload;
}

export const useDeleteCapture = (dexId: string) => {
  return useMutation<void, Error, DeleteCaptureMutationVariables>({
    mutationFn: async ({ payload }) => {
      await mutateAppState((state) => {
        const dex = findDex(state, dexId);
        for (const id of payload.pokemon) {
          // a sealed mon is never released
          if (dex.progress[id]?.sealed) {
            continue;
          }
          delete dex.progress[id];
        }
      });
    },
  });
};

export interface UpdateCapturePayload extends Partial<CaptureMetadata> {
  pokemon: number;
  status?: CaptureStatus;
  sealed?: boolean;
}

interface UpdateCaptureMutationVariables {
  payload: UpdateCapturePayload;
}

// editingSealed (TESTING seal-fx toggle) opens sealed records for data fixing
export const useUpdateCapture = (dexId: string, editingSealed = false) => {
  return useMutation<void, Error, UpdateCaptureMutationVariables>({
    mutationFn: async ({ payload }) => {
      const { pokemon, ...changes } = payload;
      await mutateAppState((state) => {
        const dex = findDex(state, dexId);
        const existing = dex.progress[pokemon];

        // only an explicit unseal gets through the freeze
        if (existing?.sealed && changes.sealed !== false && !editingSealed) {
          return;
        }

        // a missing entry means this update is the catch
        const base: ProgressEntry = existing ?? {
          ...newEntryMetadata(dex.captureDefaults, state.saves ?? [], getCatalogDex(dex.catalogKey), pokemon),
          status: dex.captureDefaults?.status ?? 'caught',
          sealed: false,
        };

        const next: ProgressEntry = { ...base, ...changes };
        // an unobtainable slot has no specimen, so it holds no metadata
        dex.progress[pokemon] = next.status === 'unobtainable' ? { ...next, ...EMPTY_METADATA } : next;
      });
    },
  });
};
