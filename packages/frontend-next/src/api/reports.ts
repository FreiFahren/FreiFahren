import { Capacitor } from '@capacitor/core';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';

import { currentCitySlug } from '@/lib/city';
import { traceAction } from '@/lib/error-monitoring';
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
// 24 h refetch. PWA cold-start freshness is handled once by invalidating on cache restore (see
// `main.tsx`), not via `refetchOnMount: 'always'` — the latter forces a refetch per observer, and
// the map subscribes several to this same slice, so it would fan out into redundant requests.
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
 * React Query options for a single report slice (`['reports', fromAgo, toAgo]`). `fromAgo`/`toAgo`
 * are millis-ago (`0` is now). The cache key is stable while the actual `from`/`to` window is
 * recomputed inside `queryFn` on every refetch, so the window rolls forward over time without
 * churning the key. A slice ending at "now" (`toAgo === 0`) is the live last-hour window and polls;
 * anything ending in the past is the older 1 h–24 h remainder, fetched once and kept fresh for an
 * hour. Shared by `useReports` and route loaders so a loader prefetch reuses the map's cache entry.
 */
export const reportsSliceQueryOptions = (fromAgo: number, toAgo: number) => {
  const isLiveSlice = toAgo === 0;
  return {
    queryKey: ['reports', fromAgo, toAgo] as const,
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
};

/**
 * Fetch reports from the last `timeframeMs` (e.g. `HOUR_MS` for the map, `DAY_MS` for the
 * overview page). Longer timeframes are stitched from the cached last-hour slice plus the
 * older remainder (see `reportSlices`), so the recent hour is shared with the map.
 */
export const useReports = (timeframeMs: number) =>
  useQueries({
    queries: reportSlices(timeframeMs).map(([fromAgo, toAgo]) =>
      reportsSliceQueryOptions(fromAgo, toAgo),
    ),
    combine: (results) => ({
      data: mergeReportSlices(results),
      isLoading: results.some((result) => result.isLoading),
      isError: results.some((result) => result.isError),
      isSuccess: results.every((result) => result.isSuccess),
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

/**
 * React Query options for a station's 7-day report history (`['reports', stationId, from, to]`).
 * `to` is rounded up to the next hour so the key is stable within an hour (and rounding *up* keeps
 * the current partial hour — and a just-submitted report — inside the window). Shared by
 * `useStationReportCount` and the report-detail route loader so a preload warms the same entry.
 */
export const stationReportCountQueryOptions = (stationId: string) => {
  const toMs = Math.ceil(Date.now() / HOUR_MS) * HOUR_MS;
  const from = new Date(toMs - WEEK_MS).toISOString();
  const to = new Date(toMs).toISOString();
  return {
    queryKey: ['reports', stationId, from, to] as const,
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      return fetchJson<Report[]>(`/v0/reports/${stationId}?${params.toString()}`);
    },
    staleTime: HOUR_MS,
  };
};

export const useStationReportCount = (stationId: string) => {
  // Freeze the window (and thus the query key) at mount; `select` reduces to the count.
  const [options] = useState(() => stationReportCountQueryOptions(stationId));
  return useQuery({ ...options, select: (reports) => reports.length });
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitReportInput): Promise<SubmitReportResponse> =>
      traceAction('Submit Report', async () => {
        const lineId = resolveLineId(input, lines);
        const submitUrl = new URL(`${API_URL}/v0/reports`);
        submitUrl.searchParams.set('city', currentCitySlug);
        // The native (Capacitor iOS/Android) builds and the web build share this same code, so the
        // report `source` — which the Reports dashboard splits on — must be derived at runtime.
        // `getPlatform()` is 'ios' | 'android' | 'web'; only 'web' is the browser build.
        const isNative = Capacitor.isNativePlatform();
        const response = await fetch(submitUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ff-platform': Capacitor.getPlatform(),
          },
          body: JSON.stringify({
            stationId: input.stationId,
            lineId,
            directionId: input.directionStationId ?? null,
            source: isNative ? 'mobile_app' : 'web_app',
          }),
        });
        if (!response.ok) throw new Error(`Report submission failed: ${response.status}`);
        return response.json();
      }),
    // The backend commits the report and clears its reports/risk caches before
    // returning 200, so by the time we get here the new data is already live —
    // no wait/race-condition guard is needed. Refetch both so the map and risk
    // overlay reflect the report immediately instead of waiting for the poll.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['risk'] });
    },
  });
}
