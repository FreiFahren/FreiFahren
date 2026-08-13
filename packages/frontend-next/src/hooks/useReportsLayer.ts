import { useRouter } from '@tanstack/react-router';
import type { FeatureCollection, Point } from 'geojson';
import { useEffect, useState } from 'react';

import { HOUR_MS, type Report, useReports } from '@/api/reports';
import { type Line, type Stations, useLines, useStations } from '@/api/transit';
import { useReportSimulation } from '@/contexts/ReportSimulation.context';
import {
  buildLineTopologies,
  burstRatePerMinute,
  computeChainInfo,
  computeReportDecay,
} from '@/lib/report-decay';
import { useIsReportViewed } from '@/lib/viewed-reports';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';

const PULSE_AGE_MS = 60 * 15 * 1000;
const RECOMPUTE_INTERVAL_MS = 30 * 1000;

export const REPORTS_HIT_LAYER_ID = 'reports-hit';
export const REPORTS_CIRCLE_LAYER_ID = 'reports-circle';

export type ReportPointProps = {
  stationId: string;
  timestamp: string;
  opacity: number;
  pulse: boolean;
};

function reportKey(report: Report): string {
  return `${report.stationId}-${report.timestamp}`;
}

function reportsToGeoJSON(
  reports: Report[],
  stations: Stations,
  lines: Line[] | undefined,
  isViewed: (stationId: string, timestamp: string) => boolean,
  nowMs: number,
): FeatureCollection<Point, ReportPointProps> {
  const lineTopologies = buildLineTopologies(lines ?? []);
  const chainByKey = computeChainInfo(reports, lineTopologies, reportKey);
  const ratePerMinute = burstRatePerMinute(reports, nowMs);

  const features = reports.flatMap((report) => {
    const station = stations[report.stationId];
    if (!station) return [];
    const chain = chainByKey.get(reportKey(report));
    const { opacity, dropped } = computeReportDecay(
      new Date(report.timestamp).getTime(),
      nowMs,
      ratePerMinute,
      chain,
    );
    if (dropped) return [];
    const age = nowMs - new Date(report.timestamp).getTime();
    const pulse =
      age < PULSE_AGE_MS &&
      (chain?.supersededAtMs ?? null) === null &&
      !isViewed(report.stationId, report.timestamp);
    return [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [station.coordinates.longitude, station.coordinates.latitude],
        },
        properties: { stationId: report.stationId, timestamp: report.timestamp, opacity, pulse },
      },
    ];
  });
  return { type: 'FeatureCollection', features };
}

/**
 * Builds the reports GeoJSON for the WebGL layer and owns its side effects: rolling opacity/pulse
 * state forward on an interval, and warming report-detail routes. Returns `null` until reports +
 * stations have loaded.
 */
export function useReportsLayer(): FeatureCollection<Point, ReportPointProps> | null {
  const { data: liveReports } = useReports(HOUR_MS);
  const { data: stations } = useStations();
  const { data: lines } = useLines();
  const isViewed = useIsReportViewed();
  const router = useRouter();
  const simulation = useReportSimulation();
  const [wallNow, setWallNow] = useState(() => Date.now());

  useEffect(() => {
    if (simulation.nowMs !== null) return;
    const id = window.setInterval(() => setWallNow(Date.now()), RECOMPUTE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [simulation.nowMs]);

  const reports = simulation.reports ?? liveReports;
  const now = simulation.nowMs ?? wallNow;

  const data =
    reports && stations ? reportsToGeoJSON(reports, stations, lines, isViewed, now) : null;

  // Warm the report-detail route for every visible report. Reports navigate imperatively, so the
  // router's viewport preloading never sees them. Keyed on the station-id set so it only re-runs
  // when which reports are shown changes, not on every opacity recompute.
  const stationIdsKey = [...new Set(reports?.map((report) => report.stationId))].sort().join(',');
  useEffect(() => {
    if (!stationIdsKey) return;
    for (const stationId of stationIdsKey.split(',')) {
      void router.preloadRoute({ to: ReportDetailRoute.to, params: { stationId } });
    }
  }, [router, stationIdsKey]);

  return data;
}
