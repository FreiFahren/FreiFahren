import { type QueryClient, useQuery } from '@tanstack/react-query';

import { DAY_MS } from './reports';
import { fetchJson } from './client';

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

export function prefetchLineInsights(queryClient: QueryClient, lineNames: string[]) {
  const pending: string[] = [];
  let batch: Promise<LineInsights[]> | undefined;
  for (const lineName of new Set(lineNames)) {
    void queryClient.prefetchQuery({
      ...lineInsightsQueryOptions(lineName),
      queryFn: () => {
        if (pending.includes(lineName)) return lineInsightsQueryOptions(lineName).queryFn();
        pending.push(lineName);
        // Keep the individual cache keys (including in-flight deduplication) while sharing one request.
        batch ??= Promise.resolve().then(() =>
          fetchJson<LineInsights[]>(
            `/v0/insights/lines?names=${encodeURIComponent(pending.sort().join(','))}`,
          ),
        );
        return batch.then((insights) => {
          const insight = insights.find((entry) => entry.line.name === lineName);
          if (!insight) throw new Error('Missing line insights');
          return insight;
        });
      },
    });
  }
}

export const REPORT_SUMMARY_PERIODS = ['24h', '7d', '30d'] as const;
export type ReportSummaryPeriod = (typeof REPORT_SUMMARY_PERIODS)[number];

export type ReportSummary = {
  period: ReportSummaryPeriod;
  range: { start: string; end: string };
  timezone: string;
  reportCount: number;
  lines: Array<{
    name: string;
    score: number;
    share: number;
    /** Score per local hour of day, index 0–23. */
    hours: number[];
  }>;
};

// The CDN keeps each summary for an hour, so refetching more often mostly returns the same response.
export const reportSummaryQueryOptions = (period: ReportSummaryPeriod) => ({
  queryKey: ['insights', 'summary', period] as const,
  queryFn: () => fetchJson<ReportSummary>(`/v0/insights/summary?period=${period}`),
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,
});

export const useReportSummary = (period: ReportSummaryPeriod) =>
  useQuery(reportSummaryQueryOptions(period));
