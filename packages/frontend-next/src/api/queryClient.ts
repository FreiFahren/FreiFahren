import { QueryClient } from '@tanstack/react-query';

export const PERSISTED_CACHE_MAX_AGE = 1000 * 60 * 60 * 24;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      gcTime: PERSISTED_CACHE_MAX_AGE,
    },
  },
});
