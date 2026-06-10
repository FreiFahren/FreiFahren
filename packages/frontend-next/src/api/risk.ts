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
    // Always revalidate on mount so a PWA cold start (cache rehydrated from IndexedDB with its
    // original `dataUpdatedAt`) refetches even within `staleTime`, instead of serving a stale snapshot.
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    staleTime: 30_000,
  }) as const;

export const useRisk = () => useQuery(riskQueryOptions());
