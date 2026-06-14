import { useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Marker, type MarkerEvent } from 'react-map-gl/maplibre';

import type { Report } from '@/api/reports';
import type { Station } from '@/api/transit';
import { track } from '@/lib/analytics';
import { markReportViewed, useReportViewed } from '@/lib/viewed-reports';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';

const FADE_DURATION_MS = 60 * 60 * 1000;
const MIN_OPACITY = 0.4;
const PULSE_AGE_MS = 60 * 15 * 1000;
const RECOMPUTE_INTERVAL_MS = 30 * 1000;

type ReportMarkerProps = {
  report: Report;
  station: Station;
};

function computeOpacity(timestamp: string, nowMs: number): number {
  const age = nowMs - new Date(timestamp).getTime();
  if (age >= FADE_DURATION_MS) return 0;
  return Math.max(MIN_OPACITY, 1 - age / FADE_DURATION_MS);
}

export function ReportMarker({ report, station }: ReportMarkerProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const viewed = useReportViewed(report.stationId, report.timestamp);

  // Markers navigate imperatively, so the router's viewport preloading doesn't see them. Mirror it:
  // a visible marker warms its report-detail route — the chunk plus the loader data (station +
  // this-week count) — so opening it is instant instead of fetching on tap.
  useEffect(() => {
    void router.preloadRoute({ to: ReportDetailRoute.to, params: { stationId: report.stationId } });
  }, [router, report.stationId]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), RECOMPUTE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const opacity = computeOpacity(report.timestamp, now);
  if (opacity <= 0) return null;

  const age = now - new Date(report.timestamp).getTime();
  // Pulse only while the report is fresh and the user has not viewed it yet.
  const shouldPulse = age < PULSE_AGE_MS && !viewed;

  const handleClick = (event: MarkerEvent<MouseEvent>) => {
    // Stop the map's onClick from also firing (which would open the station detail).
    event.originalEvent.stopPropagation();
    track('report_marker_selected', { report_age_seconds: Math.round(age / 1000) });
    markReportViewed(report.stationId, report.timestamp);
    void navigate({ to: ReportDetailRoute.to, params: { stationId: report.stationId } });
  };

  return (
    <Marker
      latitude={station.coordinates.latitude}
      longitude={station.coordinates.longitude}
      opacity={opacity.toString()}
      onClick={handleClick}
    >
      <span className="relative block h-5 w-5 cursor-pointer">
        {shouldPulse && (
          <span className="bg-destructive pointer-events-none absolute inset-0 animate-ping rounded-full opacity-75" />
        )}
        <span className="bg-destructive relative block h-5 w-5 rounded-full border-2 border-white shadow-sm" />
      </span>
    </Marker>
  );
}
