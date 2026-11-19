import { Capacitor } from '@capacitor/core';
import {
  type QueryClient,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';

import { track } from '@/lib/analytics';
import { currentCitySlug } from '@/lib/city';
import { TURNSTILE_TOKEN_HEADER } from '@/lib/turnstile';
import { captureIssue, traceAction } from '@/lib/error-monitoring';
import { safeLocalStorage } from '@/lib/safe-storage';

import { API_URL, fetchJson } from './client';
import { type Line, useLines } from './transit';

export type Report = {
  timestamp: string;
  stationId: string;
  directionId: string | null;
  lineId: string | null;
  isPredicted: boolean;
  /** Present only while a locally submitted report is waiting for the API response. */
  optimisticId?: string;
  /*
   * When this report stops counting as live — the API's call, since it takes the whole city's
   * reports to spot a burst or a controller moving down a line. Everything that asks "is this
   * current?" compares this one instant against the clock, so the map, the risk overlay and the
   * counter cannot drift apart. It is often in the past: a 24h or 7d window is mostly reports that
   * expired long ago, and they still happened. `null` means it never expires (predicted reports).
   */
  expiresAt: string | null;
};

type OptimisticReport = Report & { optimisticId: string };

const LOCAL_REPORTS_KEY = 'localReports';
const LOCAL_REPORT_TTL_MS = 24 * 60 * 60 * 1000;

/*
 * Reports the API did not accept, kept on this device so the reporter keeps seeing their own pin
 * across reloads for as long as any list view would still show a report that age.
 */
function readLocalReports(): OptimisticReport[] {
  try {
    const entries: unknown = JSON.parse(safeLocalStorage.getItem(LOCAL_REPORTS_KEY) ?? '[]');
    if (!Array.isArray(entries)) return [];
    const cutoff = Date.now() - LOCAL_REPORT_TTL_MS;
    return entries.filter(
      (entry): entry is OptimisticReport =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.optimisticId === 'string' &&
        typeof entry.stationId === 'string' &&
        typeof entry.timestamp === 'string' &&
        new Date(entry.timestamp).getTime() > cutoff,
    );
  } catch {
    return [];
  }
}

function persistLocalReport(report: OptimisticReport): void {
  safeLocalStorage.setItem(LOCAL_REPORTS_KEY, JSON.stringify([...readLocalReports(), report]));
}

const pendingOptimisticReports = new Map<string, OptimisticReport>(
  readLocalReports().map((report) => [report.optimisticId, report]),
);

function isInRange(report: Report, fromMs: number, toMs: number): boolean {
  const timestamp = new Date(report.timestamp).getTime();
  return timestamp >= fromMs && timestamp <= toMs;
}

function isServerEquivalent(report: Report, optimisticReport: OptimisticReport): boolean {
  return (
    !report.optimisticId &&
    report.stationId === optimisticReport.stationId &&
    report.lineId === optimisticReport.lineId &&
    report.directionId === optimisticReport.directionId &&
    Math.abs(
      new Date(report.timestamp).getTime() - new Date(optimisticReport.timestamp).getTime(),
    ) < 10_000
  );
}

function withPendingOptimisticReports(
  reports: Report[],
  fromMs: number,
  toMs: number,
  stationId?: string,
): Report[] {
  const pending = [...pendingOptimisticReports.values()].filter(
    (report) =>
      isInRange(report, fromMs, toMs) &&
      (stationId === undefined || report.stationId === stationId) &&
      !reports.some((item) => isServerEquivalent(item, report)),
  );
  return [...pending, ...reports];
}

function isReportListQuery(
  queryKey: readonly unknown[],
): queryKey is ['reports', number, number, ...unknown[]] {
  return (
    queryKey[0] === 'reports' && typeof queryKey[1] === 'number' && typeof queryKey[2] === 'number'
  );
}

function isStationReportsQuery(
  queryKey: readonly unknown[],
): queryKey is ['reports', string, string, string] {
  return (
    queryKey[0] === 'reports' &&
    typeof queryKey[1] === 'string' &&
    typeof queryKey[2] === 'string' &&
    typeof queryKey[3] === 'string'
  );
}

function reportsCacheRange(queryKey: readonly unknown[]): [number, number] | null {
  if (isReportListQuery(queryKey)) {
    const now = Date.now();
    return [now - queryKey[1], now - queryKey[2]];
  }
  if (isStationReportsQuery(queryKey)) {
    return [new Date(queryKey[2]).getTime(), new Date(queryKey[3]).getTime()];
  }
  return null;
}

function reportsCacheStationId(queryKey: readonly unknown[]): string | undefined {
  return isStationReportsQuery(queryKey) ? queryKey[1] : undefined;
}

function updateOptimisticReportsInCache(queryClient: QueryClient) {
  for (const query of queryClient.getQueryCache().findAll({
    predicate: (query) => reportsCacheRange(query.queryKey) !== null,
  })) {
    const range = reportsCacheRange(query.queryKey);
    if (!range) continue;
    queryClient.setQueryData<Report[]>(query.queryKey, (reports) =>
      reports === undefined
        ? reports
        : withPendingOptimisticReports(reports, ...range, reportsCacheStationId(query.queryKey)),
    );
  }
}

function replaceOptimisticReportInCache(
  queryClient: QueryClient,
  optimisticId: string,
  result: SubmitReportResponse,
) {
  for (const query of queryClient.getQueryCache().findAll({
    predicate: (query) => reportsCacheRange(query.queryKey) !== null,
  })) {
    queryClient.setQueryData<Report[]>(query.queryKey, (reports) =>
      reports?.map((report) =>
        report.optimisticId === optimisticId
          ? {
              timestamp: result.timestamp,
              stationId: result.stationId,
              lineId: result.lineId,
              directionId: result.directionId,
              isPredicted: false,
              // The following refetch supplies the server-calculated expiry. Keeping this
              // temporary value avoids a visible gap between the optimistic and server records.
              expiresAt: report.expiresAt,
            }
          : report,
      ),
    );
  }
}

/** Whether a report is still current, as opposed to something that merely happened in the window. */
export const isReportLive = (report: Report, nowMs: number): boolean =>
  report.expiresAt === null || new Date(report.expiresAt).getTime() > nowMs;

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
 * (`[HOUR_MS, 0]`) from other history views and fetch only the remaining older slice (`[timeframeMs, HOUR_MS]`). Stitching them back
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

// The live map and the recent-history slice (`toAgo === 0`) both poll
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

type ReportsQuery =
  { mode: 'live'; timeframeMs?: never } | { mode: 'history'; timeframeMs: number };

type ReportsSliceQuery =
  | { mode: 'live'; fromAgo?: never; toAgo?: never }
  | { mode: 'history'; fromAgo: number; toAgo: number };

/**
 * Mode belongs in the cache key: live fallback predictions must never backfill history.
 * History windows roll forward on refetch while their millis-ago keys stay stable.
 * Live requests leave the window to the server so client clock skew cannot change it.
 */
export const reportsQueryOptions = (options: ReportsSliceQuery) => {
  const { mode } = options;
  const fromAgo = options.mode === 'live' ? HOUR_MS : options.fromAgo;
  const toAgo = options.mode === 'live' ? 0 : options.toAgo;
  return {
    queryKey: ['reports', fromAgo, toAgo, mode] as const,
    queryFn: async () => {
      const now = Date.now();
      const params = new URLSearchParams({ mode });
      if (mode === 'history') {
        params.set('from', new Date(now - fromAgo).toISOString());
        params.set('to', new Date(now - toAgo).toISOString());
      }
      const reports = await fetchJson<Report[]>(`/v0/reports?${params.toString()}`);
      return withPendingOptimisticReports(reports, now - fromAgo, now - toAgo);
    },
    ...(toAgo === 0 ? LIVE_SLICE_POLLING : OLDER_SLICE_POLLING),
  };
};

/**
 * Every caller chooses live or history explicitly. Longer history windows share the
 * cached recent-history slice and fetch only the older remainder (see `reportSlices`).
 */
export const useReports = (options: ReportsQuery) =>
  useQueries({
    queries:
      options.mode === 'live'
        ? [reportsQueryOptions({ mode: 'live' })]
        : reportSlices(options.timeframeMs).map(([fromAgo, toAgo]) =>
            reportsQueryOptions({ mode: 'history', fromAgo, toAgo }),
          ),
    combine: (results) => ({
      data: options.mode === 'live' ? results[0]?.data : mergeReportSlices(results),
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
    queryFn: async () => {
      const params = new URLSearchParams({ mode: 'history', from, to });
      const reports = await fetchJson<Report[]>(`/v0/reports/${stationId}?${params.toString()}`);
      return withPendingOptimisticReports(
        reports,
        new Date(from).getTime(),
        new Date(to).getTime(),
        stationId,
      );
    },
    staleTime: HOUR_MS,
  };
};

export const useStationReportCount = (stationId: string) => {
  // Freeze the window (and thus the query key) at mount; `select` reduces to the count.
  const [options] = useState(() => stationReportCountQueryOptions(stationId));
  return useQuery({ ...options, select: (reports) => reports.length });
};

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
  /** The API never accepted it; the report exists only in this device's cache. */
  local?: boolean;
};

type SubmitReportMutationInput = SubmitReportInput & {
  /*
   * Minted by the form's verification step. Missing tokens are sent to the server for assessment.
   */
  turnstileToken?: string;
  attemptId?: string;
};

/*
 * The API answers a rejected submission with a stable `details.internal_code` alongside the status.
 * Carrying that code on the error is what lets the form tell "reporting is switched off" apart from
 * any other failure — matching on the human-readable message instead would break the moment the
 * wording changes, which it is free to do.
 */
export class SubmitReportError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Report submission failed: ${status}`);
    this.name = 'SubmitReportError';
    this.status = status;
  }
}

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
    mutationFn: (input: SubmitReportMutationInput): Promise<SubmitReportResponse> =>
      traceAction('Submit Report', async () => {
        const lineId = resolveLineId(input, lines);
        const submitUrl = new URL(`${API_URL}/v0/reports`);
        submitUrl.searchParams.set('city', currentCitySlug);
        // The native (Capacitor iOS/Android) builds and the web build share this same code, so the
        // report `source` — which the Reports dashboard splits on — must be derived at runtime.
        // `getPlatform()` is 'ios' | 'android' | 'web'; only 'web' is the browser build.
        const isNative = Capacitor.isNativePlatform();
        const { turnstileToken } = input;
        const startedAt = Date.now();
        const telemetry = () => ({
          attemptId: input.attemptId,
          tokenPresent: Boolean(turnstileToken),
          durationMs: Date.now() - startedAt,
        });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        try {
          const response = await fetch(submitUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: {
              'Content-Type': 'application/json',
              'ff-platform': Capacitor.getPlatform(),
              ...(turnstileToken === undefined ? {} : { [TURNSTILE_TOKEN_HEADER]: turnstileToken }),
            },
            body: JSON.stringify({
              stationId: input.stationId,
              lineId,
              directionId: input.directionStationId ?? null,
              source: isNative ? 'mobile_app' : 'web_app',
            }),
          });
          if (!response.ok) {
            throw new SubmitReportError(response.status);
          }
          const result = await response.json();
          track('report_delivery_completed', { ...telemetry(), outcome: 'received' });
          return result;
        } catch (error) {
          // Keep the local copy, but distinguish it from a report acknowledged by the API.
          const reason = controller.signal.aborted
            ? 'timeout'
            : error instanceof SubmitReportError
              ? 'http_error'
              : error instanceof SyntaxError
                ? 'invalid_response'
                : 'network_error';
          const failure = {
            ...telemetry(),
            reason,
            status: error instanceof SubmitReportError ? error.status : undefined,
          } as const;
          captureIssue('Report submit failed', failure);
          track('report_delivery_completed', { ...failure, outcome: 'saved_locally' });
          return {
            reportId: -1,
            stationId: input.stationId,
            lineId,
            directionId: input.directionStationId ?? null,
            timestamp: new Date().toISOString(),
            local: true,
          };
        } finally {
          clearTimeout(timeout);
        }
      }),
    onMutate: async (input) => {
      const timestamp = new Date().toISOString();
      const optimisticReport: OptimisticReport = {
        optimisticId: crypto.randomUUID(),
        timestamp,
        stationId: input.stationId,
        lineId: resolveLineId(input, lines),
        directionId: input.directionStationId ?? null,
        isPredicted: false,
        // The server recalculates expiry based on all reports. This temporary value only keeps
        // the pending item visible until its authoritative replacement is fetched.
        expiresAt: new Date(Date.now() + HOUR_MS).toISOString(),
      };

      pendingOptimisticReports.set(optimisticReport.optimisticId, optimisticReport);
      // An in-flight or interval refetch must not overwrite a report that is still pending.
      await queryClient.cancelQueries({ queryKey: ['reports'] });
      updateOptimisticReportsInCache(queryClient);
      return optimisticReport;
    },
    // Replace in place before invalidating. The active view keeps a record during the refetch,
    // then receives the server's calculated expiry without a blank or duplicate state.
    onSuccess: (result, _input, optimisticReport) => {
      // A local report keeps its pending entry, which every refetch merges back in.
      if (result.local) {
        persistLocalReport(optimisticReport);
        // The screen shows the moment the user reported, which is the optimistic entry's time.
        result.timestamp = optimisticReport.timestamp;
        return;
      }
      pendingOptimisticReports.delete(optimisticReport.optimisticId);
      replaceOptimisticReportInCache(queryClient, optimisticReport.optimisticId, result);
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
      void queryClient.invalidateQueries({ queryKey: ['risk'] });
    },
  });
}
