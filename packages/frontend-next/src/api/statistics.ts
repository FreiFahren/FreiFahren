import { useQuery } from '@tanstack/react-query';

import { fetchJson } from './client';

export const STATISTICS_PERIODS = ['24h', '7d', '30d', 'all'] as const;
export type StatisticsPeriod = (typeof STATISTICS_PERIODS)[number];

export type ReportStatistics = {
  period: StatisticsPeriod;
  range: { start: string | null; end: string };
  computedAt: string;
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

/*
 * The server recomputes these snapshots on a schedule (hourly, all-time daily), so refetching more
 * often than every few minutes would only ever return the same snapshot.
 */
export const reportStatisticsQueryOptions = (period: StatisticsPeriod) => ({
  queryKey: ['statistics', period] as const,
  queryFn: () => fetchJson<ReportStatistics>(`/v0/statistics?period=${period}`),
  staleTime: 5 * 60 * 1000,
  refetchOnWindowFocus: true,
});

export const useReportStatistics = (period: StatisticsPeriod) =>
  useQuery(reportStatisticsQueryOptions(period));
