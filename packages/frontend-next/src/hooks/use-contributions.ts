import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { fetchFund } from '@/lib/fund-api';

export type ContributionPeriod = { start: string; end: string };
export type Contribution = {
  id: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  paidAt: string | null;
  periods: ContributionPeriod[];
  status: 'paid' | 'pending' | 'failed' | 'action_required' | 'void' | 'uncollectible';
  failureReason: 'insufficient_funds' | 'expired_card' | 'declined' | 'payment_failed' | null;
};
export type ContributionsResponse = {
  contributions: Contribution[];
  paidPeriod: ContributionPeriod | null;
};

export function useContributions(
  userId: string,
  sessionId: string,
): UseQueryResult<ContributionsResponse, Error> {
  return useQuery<ContributionsResponse, Error>({
    queryKey: ['fund', userId, sessionId, 'contributions'],
    queryFn: async ({ signal }): Promise<ContributionsResponse> =>
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
