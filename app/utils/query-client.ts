import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // All data is local (bundled JSON + a file on disk), so there's nothing
      // transient to retry and nothing that goes stale behind our back.
      retry: false,
      refetchOnMount: 'always',
      staleTime: Infinity,
    },
  },
});
