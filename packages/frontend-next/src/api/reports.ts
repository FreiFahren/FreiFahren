import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';

import { requireEnv } from '@/lib/utils';

import { fetchJson, type Line, useLines } from './transit';

export type Report = {
  timestamp: string;
  stationId: string;
  directionId: string | null;
  lineId: string | null;
  isPredicted: boolean;
};

/**
 * Human-readable "time since" for a report timestamp, using the caller's i18n `t`. The
 * caller's namespace must provide the keys `now`, `minutesAgo`, `moreThan45Min`, and
 * `hoursAgo` (see e.g. `ReportDetail.i18n.ts` / `Reports.i18n.ts`).
 */
export function formatElapsed(timestamp: string, t: TFunction): string {
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000);
  if (minutes <= 1) return t('now');
  if (minutes <= 45) return t('minutesAgo', { count: minutes });
  if (minutes < 60) return t('moreThan45Min');
  return t('hoursAgo', { count: Math.floor(minutes / 60) });
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Split a window into one or more `[fromAgo, toAgo]` slices (millis-ago, where `0` is now).
 *
 * Windows up to an hour are a single slice. Longer windows reuse the last-hour slice
 * (`[HOUR_MS, 0]`) — the very same query the map and overview button already cache — and
 * fetch only the remaining older slice (`[timeframeMs, HOUR_MS]`). Stitching them back
 * together keeps the recent hour consistent everywhere and reuses its cache, while hiding
 * that split from callers.
 */
function reportSlices(timeframeMs: number): Array<[fromAgo: number, toAgo: number]> {
  if (timeframeMs <= HOUR_MS) return [[timeframeMs, 0]];
  return [
    [HOUR_MS, 0],
    [timeframeMs, HOUR_MS],
  ];
}

/** Merge slice results into a single de-duplicated list, or `undefined` until any load. */
function mergeReportSlices(
  results: ReadonlyArray<{ data: Report[] | undefined }>,
): Report[] | undefined {
  if (results.every((result) => result.data === undefined)) return undefined;
  const seen = new Set<string>();
  const merged: Report[] = [];
  for (const { data } of results) {
    for (const report of data ?? []) {
      const key = `${report.stationId}-${report.timestamp}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(report);
    }
  }
  return merged;
}

// The live last-hour slice (`toAgo === 0`) powers the map and recent-reports views, so it polls
// every 30 s. The older `[DAY_MS, HOUR_MS]` remainder changes slowly: no interval polling, fresh
// for an hour. Either way the shared last-hour slice keeps recent reports current without a full
// 24 h refetch.
const LIVE_SLICE_POLLING = {
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  staleTime: 30_000,
} as const;

const OLDER_SLICE_POLLING = {
  refetchInterval: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  staleTime: HOUR_MS,
} as const;

/**
 * Fetch reports from the last `timeframeMs` (e.g. `HOUR_MS` for the map, `DAY_MS` for the
 * overview page). Each slice's cache key is stable (`['reports', fromAgo, toAgo]`) while its
 * actual `from`/`to` window is recomputed inside `queryFn` on every (30 s) refetch, so the
 * window rolls forward over time the same way the server's default endpoint did — without
 * churning the key. Longer timeframes are stitched from the cached last-hour slice plus the
 * older remainder (see `reportSlices`), so the recent hour is shared with the map.
 */
export const useReports = (timeframeMs: number) =>
  useQueries({
    queries: reportSlices(timeframeMs).map(([fromAgo, toAgo]) => {
      // A slice ending at "now" (`toAgo === 0`) is the live last-hour window; anything ending
      // in the past is the older 1 h–24 h remainder.
      const isLiveSlice = toAgo === 0;
      return {
        queryKey: ['reports', fromAgo, toAgo],
        queryFn: () => {
          const now = Date.now();
          const params = new URLSearchParams({
            from: new Date(now - fromAgo).toISOString(),
            to: new Date(now - toAgo).toISOString(),
          });
          return fetchJson<Report[]>(`/v0/reports?${params.toString()}`);
        },
        ...(isLiveSlice ? LIVE_SLICE_POLLING : OLDER_SLICE_POLLING),
      };
    }),
    combine: (results) => ({
      data: mergeReportSlices(results),
      isLoading: results.some((result) => result.isLoading),
      isError: results.some((result) => result.isError),
    }),
  });

/** A counter that ticks up each time any `['reports', …]` query finishes a refetch */
export const useReportsRefreshSignal = () => {
  const queryClient = useQueryClient();
  const [signal, setSignal] = useState(0);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    return cache.subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const { query } = event;
      // `dataUpdateCount` is 1 after the initial fetch, so >1 means this success was a refetch.
      if (query.queryKey[0] !== 'reports' || query.state.dataUpdateCount <= 1) return;
      setSignal((n) => n + 1);
    });
  }, [queryClient]);

  return signal;
};

export const useStationReportCount = (stationId: string) => {
  // Compute the window once per mount (lazy initializer), rounding `to` up to
  // the next hour. Rounding keeps the query key stable across renders; rounding
  // *up* (rather than down) keeps the current partial hour inside the window, so
  // a report submitted moments ago is still counted.
  const [{ from, to }] = useState(() => {
    const toMs = Math.ceil(Date.now() / HOUR_MS) * HOUR_MS;
    return { from: new Date(toMs - WEEK_MS).toISOString(), to: new Date(toMs).toISOString() };
  });

  return useQuery({
    queryKey: ['reports', stationId, from, to],
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      return fetchJson<Report[]>(`/v0/reports/${stationId}?${params.toString()}`);
    },
    select: (reports) => reports.length,
    staleTime: HOUR_MS,
  });
};

const API_URL = requireEnv('VITE_API_URL');

export type SubmitReportInput = {
  stationId: string;
  lineName?: string | null;
  directionStationId?: string | null;
};

export type SubmitReportResponse = {
  reportId: number;
  stationId: string;
  lineId: string | null;
  directionId: string | null;
  timestamp: string;
};

/**
 * Pick the concrete `lines.id` variant to submit from the user's high-level selection.
 * Narrows by station membership first, then by terminus when a direction was picked.
 *
 * HACK: when the selection still matches multiple variants we fall back to the canonical
 * "-a" variant. Reporting should instead accept multiple candidate lines so the backend
 * can disambiguate from other signals — tracked in
 * https://linear.app/freifahren/issue/FRE-585/accept-multiple-candidate-lines-for-ambiguous-reports
 */
function resolveLineId(input: SubmitReportInput, lines: Line[] | undefined): string | null {
  if (!input.lineName || !lines) return null;

  const candidates = lines.filter(
    (l) => l.name === input.lineName && l.stations.includes(input.stationId),
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].id;

  if (input.directionStationId) {
    const narrowed = candidates.filter((l) => {
      const first = l.stations[0];
      const last = l.stations[l.stations.length - 1];
      return first === input.directionStationId || last === input.directionStationId;
    });
    if (narrowed.length === 1) return narrowed[0].id;
    if (narrowed.length > 1) {
      return narrowed.find((l) => l.id.endsWith('-a'))?.id ?? narrowed[0].id;
    }
  }

  return candidates.find((l) => l.id.endsWith('-a'))?.id ?? candidates[0].id;
}

export function useSubmitReport() {
  const { data: lines } = useLines();
  return useMutation({
    mutationFn: async (input: SubmitReportInput): Promise<SubmitReportResponse> => {
      const lineId = resolveLineId(input, lines);
      const response = await fetch(`${API_URL}/v0/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stationId: input.stationId,
          lineId,
          directionId: input.directionStationId ?? null,
          source: 'web_app',
        }),
      });
      if (!response.ok) throw new Error(`Report submission failed: ${response.status}`);
      return response.json();
    },
  });
}
