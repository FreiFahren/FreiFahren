import type { FeatureCollection, Point } from 'geojson';

import type { Report } from '@/api/reports';
import type { Line, Stations } from '@/api/transit';
import { MIN_OPACITY, reportOpacity } from './report-decay';
import { reportDirectionBearing } from './report-direction';

const PULSE_AGE_MS = 60 * 15 * 1000;
const PULSE_EXPIRY_LEAD_MS = 3 * 60 * 1000;

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
export function reportsToGeoJSON(
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
    const isExpiring = expiresAtMs !== null && expiresAtMs - nowMs < PULSE_EXPIRY_LEAD_MS;
    const pulse =
      age < PULSE_AGE_MS && !isExpiring && !isViewed(report.stationId, report.timestamp);
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
