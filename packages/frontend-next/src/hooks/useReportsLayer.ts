import { useRouter } from '@tanstack/react-router';
import type { FeatureCollection, Point } from 'geojson';
import { useEffect, useState } from 'react';

import { HOUR_MS, type Report, useReports } from '@/api/reports';
import { type Stations, useStations } from '@/api/transit';
import { useIsReportViewed } from '@/lib/viewed-reports';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';

// Fade opacity from 1 → MIN_OPACITY over the first hour, then drop the report.
const FADE_DURATION_MS = 60 * 60 * 1000;
const MIN_OPACITY = 0.4;
// Pulse while a report is fresh and the user has not opened it yet.
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

function reportsToGeoJSON(
  reports: Report[],
  stations: Stations,
  isViewed: (stationId: string, timestamp: string) => boolean,
  nowMs: number,
): FeatureCollection<Point, ReportPointProps> {
  const features = reports.flatMap((report) => {
    const station = stations[report.stationId];
    if (!station) return [];
    const age = nowMs - new Date(report.timestamp).getTime();
    if (age >= FADE_DURATION_MS) return [];
    const opacity = Math.max(MIN_OPACITY, 1 - age / FADE_DURATION_MS);
    const pulse = age < PULSE_AGE_MS && !isViewed(report.stationId, report.timestamp);
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
  const { data: reports } = useReports(HOUR_MS);
  const { data: stations } = useStations();
  const isViewed = useIsReportViewed();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), RECOMPUTE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const data = reports && stations ? reportsToGeoJSON(reports, stations, isViewed, now) : null;

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
