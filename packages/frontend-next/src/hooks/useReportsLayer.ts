import { useRouter } from '@tanstack/react-router';
import type { FeatureCollection, Point } from 'geojson';
import { useEffect } from 'react';

import { HOUR_MS, type Report, useReports } from '@/api/reports';
import { type Line, type Stations, useLines, useStations } from '@/api/transit';
import { useReportSimulation } from '@/contexts/ReportSimulation.context';
import { useNow } from '@/hooks/useNow';
import { MIN_OPACITY, reportOpacity } from '@/lib/report-decay';
import { reportDirectionBearing } from '@/lib/report-direction';
import { useIsReportViewed } from '@/lib/viewed-reports';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';

const PULSE_AGE_MS = 60 * 15 * 1000;

/** How often anything showing live reports re-reads the clock to roll expiry and fade forward. */
export const REPORT_RECOMPUTE_INTERVAL_MS = 30 * 1000;

export const REPORTS_HIT_LAYER_ID = 'reports-hit';
export const REPORTS_CIRCLE_LAYER_ID = 'reports-circle';

export type ReportPointProps = {
  stationId: string;
  timestamp: string;
  opacity: number;
  pulse: boolean;
  bearing: number | null;
};

/*
 * The map draws the reports that are still live, at the opacity they have run down to. Which ones
 * those are is the API's call — it stamps every report with an `expiresAt` computed from the whole
 * city's reports, which is also what the risk overlay and the report counter read, so the three
 * cannot disagree about what is current. All that is left here is the fade.
 */
function reportsToGeoJSON(
  reports: Report[],
  stations: Stations,
  isViewed: (stationId: string, timestamp: string) => boolean,
  nowMs: number,
  lines: Line[],
): FeatureCollection<Point, ReportPointProps> {
  const features = reports.flatMap((report) => {
    const station = stations[report.stationId];
    if (!station) return [];
    const expiresAtMs = report.expiresAt === null ? null : new Date(report.expiresAt).getTime();
    // Predictions have no expiry because they are a stand-in for missing data, not because they
    // have the same confidence as a fresh sighting. Keep them visible but visually subordinate.
    const opacity = report.isPredicted
      ? MIN_OPACITY
      : reportOpacity(new Date(report.timestamp).getTime(), expiresAtMs, nowMs);
    if (opacity === null) return [];
    const age = nowMs - new Date(report.timestamp).getTime();
    // A report on its way out has stopped being news, so it stops pulsing before it stops showing.
    const isFadingOut = opacity < MIN_OPACITY;
    const pulse =
      age < PULSE_AGE_MS && !isFadingOut && !isViewed(report.stationId, report.timestamp);
    return [
      {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [station.coordinates.longitude, station.coordinates.latitude],
        },
        properties: {
          stationId: report.stationId,
          timestamp: report.timestamp,
          opacity,
          pulse,
          bearing: reportDirectionBearing(report, lines, stations),
        },
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
  // The simulation drives its own clock, so the wall clock stops ticking while it is active.
  const wallNow = useNow(simulation.nowMs !== null ? null : REPORT_RECOMPUTE_INTERVAL_MS);

  const reports = simulation.reports ?? liveReports;
  const now = simulation.nowMs ?? wallNow;

  const data =
    reports && stations ? reportsToGeoJSON(reports, stations, isViewed, now, lines ?? []) : null;

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
