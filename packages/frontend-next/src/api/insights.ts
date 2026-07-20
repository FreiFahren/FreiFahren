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

export type LineInsights = {
  line: {
    name: string;
    variantCount: number;
  };
  profile: {
    source: 'line_reports' | 'city_reports';
    metric: { name: 'report_count'; range: { start: string; end: string } };
    weekday: number;
    hours: Array<{ hour: number; value: number }>;
  };
  hotspots: {
    source: 'reports';
    metric: { name: 'report_count'; range: { start: string; end: string } };
    stations: Array<{ stationId: string; name: string; value: number; share: number }>;
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

export const lineInsightsQueryOptions = (lineName: string) => ({
  queryKey: ['insights', 'line', lineName] as const,
  queryFn: () => fetchJson<LineInsights>(`/v0/insights/lines/${encodeURIComponent(lineName)}`),
  staleTime: DAY_MS,
  retry: 1,
});

export const useLineInsights = (lineName: string) => useQuery(lineInsightsQueryOptions(lineName));
