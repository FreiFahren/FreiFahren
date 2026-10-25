import { useQuery } from '@tanstack/react-query';

import { fetchFund, type FineDetails } from '@/lib/fund-api';

import { fundHistoryKey } from './use-fund-history';

export const fineDetailsKey = (userId: string, sessionId: string, fineId: string) =>
  [...fundHistoryKey(userId, sessionId), fineId] as const;

export function useFineDetails(userId: string, sessionId: string, fineId: string) {
  return useQuery({
    queryKey: fineDetailsKey(userId, sessionId, fineId),
    queryFn: async ({ signal }): Promise<FineDetails> =>
      (await fetchFund(`/fines/${fineId}`, { signal })).json(),
    meta: { persist: false },
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 1,
  });
}
