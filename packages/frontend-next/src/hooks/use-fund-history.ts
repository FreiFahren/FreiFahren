import { useQuery } from '@tanstack/react-query';

import { getSessionToken } from '@/lib/session';
import { optionalEnv } from '@/lib/utils';

export type Fine = {
  id: string;
  status: 'in_review' | 'paid' | 'declined';
  createdAt: string;
  declineReason: string | null;
};

async function fetchFund(path: string, signal?: AbortSignal): Promise<Response> {
  const baseUrl = optionalEnv('VITE_FUND_URL');
  const token = await getSessionToken();
  if (!baseUrl || !token) throw new Error('Fund unavailable');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'omit',
    cache: 'no-store',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('Fund request failed');
  return response;
}

export function useFundHistory(userId: string, sessionId: string) {
  return useQuery({
    queryKey: ['fund', userId, sessionId, 'fines'],
    queryFn: async ({ signal }): Promise<Fine[]> => (await fetchFund('/fines', signal)).json(),
    // Upload dates, statuses and decline reasons are private member data. Keep them out of
    // the shared IndexedDB cache so they are not retained after sign-out or browser restarts.
    meta: { persist: false },
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 1,
  });
}
