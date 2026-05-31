import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './transit';

export type SegmentRisk = { color: string; risk: number };
export type RiskData = { segments_risk: Record<string, SegmentRisk> };

export const useRisk = () =>
  useQuery({
    queryKey: ['risk'],
    queryFn: () => fetchJson<RiskData>('/v0/risk'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
