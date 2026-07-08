import { useMutation, useQuery } from '@tanstack/react-query';

import { loadProgress, progressToCaptures, saveProgress } from '../../utils/local-data';

import type { Capture } from '../../types';
import type { Progress, ProgressEntry } from '../../utils/local-data';
import type { UseQueryOptions } from '@tanstack/react-query';

export enum QueryKey {
  ListCaptures = 'ListCaptures',
}

type ListCapturesData = Capture[];

// The in-memory source of truth for persisted progress. Loaded from disk (or
// localStorage in a plain browser) when the tracker mounts, mutated by the
// hooks below, and written back on every change.
let progress: Progress = {};

export const useCaptures = (options: UseQueryOptions<ListCapturesData, Error> = {}) => {
  return useQuery<ListCapturesData, Error, ListCapturesData>({
    ...options,
    queryKey: [QueryKey.ListCaptures],
    queryFn: async () => {
      progress = await loadProgress();
      return progressToCaptures(progress);
    },
  });
};

export interface CreateCapturesPayload {
  pokemon: number[];
}

interface CreateCaptureMutationVariables {
  payload: CreateCapturesPayload;
}

export const useCreateCapture = () => {
  return useMutation<void, Error, CreateCaptureMutationVariables>({
    mutationFn: async ({ payload }) => {
      for (const id of payload.pokemon) {
        const existing = progress[id] as ProgressEntry | undefined;
        progress[id] = {
          origin_game: existing?.origin_game ?? null,
          temporary: existing?.temporary ?? false,
          captured: true,
        };
      }
      await saveProgress(progress);
    },
  });
};

export interface DeleteCapturesPayload {
  pokemon: number[];
}

interface DeleteCaptureMutationVariables {
  payload: DeleteCapturesPayload;
}

export const useDeleteCapture = () => {
  return useMutation<void, Error, DeleteCaptureMutationVariables>({
    mutationFn: async ({ payload }) => {
      for (const id of payload.pokemon) {
        // Unmarking a mon clears its origin/temporary state too — there's no
        // mon anymore for that state to describe.
        delete progress[id];
      }
      await saveProgress(progress);
    },
  });
};

export interface UpdateCapturePayload {
  pokemon: number;
  origin_game?: string | null;
  temporary?: boolean;
}

interface UpdateCaptureMutationVariables {
  payload: UpdateCapturePayload;
}

export const useUpdateCapture = () => {
  return useMutation<void, Error, UpdateCaptureMutationVariables>({
    mutationFn: async ({ payload }) => {
      const { pokemon, ...changes } = payload;
      const existing = progress[pokemon] as ProgressEntry | undefined;
      progress[pokemon] = {
        captured: existing?.captured ?? false,
        origin_game: existing?.origin_game ?? null,
        temporary: existing?.temporary ?? false,
        ...changes,
      };
      await saveProgress(progress);
    },
  });
};
