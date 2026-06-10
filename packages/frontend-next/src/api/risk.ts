import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './transit';

export type SegmentRisk = { color: string; risk: number };
export type RiskData = { segments_risk: Record<string, SegmentRisk> };

export const riskQueryOptions = () =>
  ({
    queryKey: ['risk'] as const,
    queryFn: () => fetchJson<RiskData>('/v0/risk'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    // PWA cold-start freshness is handled once by invalidating on cache restore (see `main.tsx`);
    // `refetchOnReconnect` still refreshes risk when the network comes back.
    refetchOnReconnect: true,
    staleTime: 30_000,
  }) as const;

export const useRisk = () => useQuery(riskQueryOptions());
