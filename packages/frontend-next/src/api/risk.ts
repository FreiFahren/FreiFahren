import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './transit';

export type SegmentRisk = { risk: number };
export type RiskData = { segments_risk: Record<string, SegmentRisk> };

export const RISK_COLORS = {
  clear: '#13C184',
  moderate: '#FACB3F',
  high: '#F05044',
  severe: '#A92725',
} as const;

export type RiskLevel = keyof typeof RISK_COLORS;

export const riskLevel = (risk: number): RiskLevel => {
  if (risk <= 0.2) return 'clear';
  if (risk <= 0.5) return 'moderate';
  if (risk <= 0.9) return 'high';
  return 'severe';
};

export const riskColor = (risk: number | undefined): string => RISK_COLORS[riskLevel(risk ?? 0)];

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
