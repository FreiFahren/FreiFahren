import { useQuery } from '@tanstack/react-query';

import { DAY_MS } from './reports';
import { fetchJson } from './transit';

export type StationInsights = {
  reportCount: { value: number; range: { start: string; end: string } };
  ranking: {
    position: number;
    population: number;
  };
};

export const stationInsightsQueryOptions = (stationId: string) => ({
  queryKey: ['insights', 'station', stationId] as const,
  queryFn: () => fetchJson<StationInsights>(`/v0/insights/station/${stationId}`),
  staleTime: DAY_MS,
  retry: 1,
});

export const useStationInsights = (stationId: string) =>
  useQuery(stationInsightsQueryOptions(stationId));
