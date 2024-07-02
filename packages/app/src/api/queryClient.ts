import { QueryClient } from "@tanstack/react-query";

export const CACHE_KEYS = {
  reports: ["reports"],
  stations: ["stations"],
  lines: ["lines"],
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: true,
      gcTime: Infinity,
    },
  },
});
