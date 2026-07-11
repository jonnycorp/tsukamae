import { useMutation, useQuery } from '@tanstack/react-query';

import { loadAppState, mutateAppState, progressToCaptures } from '../../utils/local-data';

import type { AppState, PersonalDex } from '../../utils/local-data';
import type { Capture, CaptureStatus } from '../../types';
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

export interface CreateCapturesPayload {
  pokemon: number[];
}

interface CreateCaptureMutationVariables {
  payload: CreateCapturesPayload;
}

export const useCreateCapture = (dexId: string) => {
  return useMutation<void, Error, CreateCaptureMutationVariables>({
    mutationFn: async ({ payload }) => {
      await mutateAppState((state) => {
        const dex = findDex(state, dexId);
        for (const id of payload.pokemon) {
          // captureDefaults prefill brand-new entries only; existing data always wins.
          dex.progress[id] = {
            status: dex.progress[id]?.status ?? dex.captureDefaults?.status ?? 'caught',
            origin_game: dex.progress[id]?.origin_game ?? dex.captureDefaults?.origin_game ?? null,
            language: dex.progress[id]?.language ?? dex.captureDefaults?.language ?? null,
          };
        }
      });
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
          // Unmarking clears all of the mon's state.
          delete dex.progress[id];
        }
      });
    },
  });
};

export interface UpdateCapturePayload {
  pokemon: number;
  origin_game?: string | null;
  status?: CaptureStatus;
  language?: string | null;
}

interface UpdateCaptureMutationVariables {
  payload: UpdateCapturePayload;
}

export const useUpdateCapture = (dexId: string) => {
  return useMutation<void, Error, UpdateCaptureMutationVariables>({
    mutationFn: async ({ payload }) => {
      const { pokemon, ...changes } = payload;
      await mutateAppState((state) => {
        const dex = findDex(state, dexId);
        const existing = dex.progress[pokemon];
        // A missing entry means this update IS the catch — prefill from captureDefaults; explicit changes win.
        const defaults = existing ? null : dex.captureDefaults;
        dex.progress[pokemon] = {
          status: existing?.status ?? 'caught',
          origin_game: existing?.origin_game ?? defaults?.origin_game ?? null,
          language: existing?.language ?? defaults?.language ?? null,
          ...changes,
        };
      });
    },
  });
};
