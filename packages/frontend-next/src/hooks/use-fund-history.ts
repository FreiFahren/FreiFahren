import { useQuery } from '@tanstack/react-query';

import { fetchFund, type Fine } from '@/lib/fund-api';

export type { Fine } from '@/lib/fund-api';

export const fundHistoryKey = (userId: string, sessionId: string) =>
  ['fund', userId, sessionId, 'fines'] as const;

export function useFundHistory(userId: string, sessionId: string) {
  return useQuery({
    queryKey: fundHistoryKey(userId, sessionId),
    queryFn: async ({ signal }): Promise<Fine[]> => (await fetchFund('/fines', { signal })).json(),
    // Upload dates and statuses are private member data. Keep them out of
    // the shared IndexedDB cache so they are not retained after sign-out or browser restarts.
    meta: { persist: false },
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 1,
  });
}
