import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { requireEnv } from '@/lib/utils';

import { fetchJson, type Line, useLines } from './transit';

export type Report = {
  timestamp: string;
  stationId: string;
  directionId: string | null;
  lineId: string | null;
  isPredicted: boolean;
};

export const useReports = () =>
  useQuery({
    queryKey: ['reports'],
    queryFn: () => fetchJson<Report[]>('/v0/reports'),
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
  });

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

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
