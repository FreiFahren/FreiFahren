import type { Contribution, Contributions } from '@freifahren/contracts/fund';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchFund } from '@/lib/fund-api';

export type { Contribution };

export function useContributions(
  userId: string,
  sessionId: string,
): UseQueryResult<Contributions, Error> {
  return useQuery<Contributions, Error>({
    queryKey: ['fund', userId, sessionId, 'contributions'],
    queryFn: async ({ signal }): Promise<Contributions> =>
      (await fetchFund('/contributions', { signal })).json(),
    meta: { persist: false },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) =>
      query.state.data?.contributions.some(
        (row) => row.status === 'pending' || row.status === 'action_required',
      )
        ? 30_000
        : false,
  });
}
