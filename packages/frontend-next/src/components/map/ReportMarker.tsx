import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Marker, type MarkerEvent } from 'react-map-gl/maplibre';

import type { Report } from '@/api/reports';
import type { Station } from '@/api/transit';
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), RECOMPUTE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const opacity = computeOpacity(report.timestamp, now);
  if (opacity <= 0) return null;

  const age = now - new Date(report.timestamp).getTime();
  const shouldPulse = age < PULSE_AGE_MS;

  const handleClick = (event: MarkerEvent<MouseEvent>) => {
    // Stop the map's onClick from also firing (which would open the station detail).
    event.originalEvent.stopPropagation();
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
