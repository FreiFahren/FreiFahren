import { useRouter } from '@tanstack/react-router';
import type { FeatureCollection, Point } from 'geojson';
import { useEffect } from 'react';

import { useReports } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { useReportSimulation } from '@/contexts/ReportSimulation.context';
import { useNow } from '@/hooks/useNow';
import { type ReportPointProps, reportsToGeoJSON } from '@/lib/reports-to-geojson';
import { useIsReportViewed } from '@/lib/viewed-reports';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';

export type { ReportPointProps } from '@/lib/reports-to-geojson';

/** How often anything showing live reports re-reads the clock to roll expiry and fade forward. */
export const REPORT_RECOMPUTE_INTERVAL_MS = 30 * 1000;

export const REPORTS_HIT_LAYER_ID = 'reports-hit';
export const REPORTS_CIRCLE_LAYER_ID = 'reports-circle';

/**
 * Builds the reports GeoJSON for the WebGL layer and owns its side effects: rolling opacity/pulse
 * state forward on an interval, and warming report-detail routes. Returns `null` until reports +
 * stations have loaded.
 */
export function useReportsLayer(): FeatureCollection<Point, ReportPointProps> | null {
  const { data: liveReports } = useReports({ mode: 'live' });
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
