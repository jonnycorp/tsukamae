import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnMount: 'always',
      // all data is local — never stale
      staleTime: Infinity,
    },
  },
});
