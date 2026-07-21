import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnMount: 'always',
      // All data is local — never stale.
      staleTime: Infinity,
    },
  },
});
