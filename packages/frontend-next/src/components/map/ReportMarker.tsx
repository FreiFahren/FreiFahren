import { useEffect, useState } from 'react';
import { Marker } from 'react-map-gl/maplibre';

import type { Report } from '@/api/reports';
import type { Station } from '@/api/transit';

const FADE_DURATION_MS = 60 * 60 * 1000;
const MIN_OPACITY = 0.2;
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), RECOMPUTE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const opacity = computeOpacity(report.timestamp, now);
  if (opacity <= 0) return null;

  const age = now - new Date(report.timestamp).getTime();
  const shouldPulse = age < PULSE_AGE_MS;

  return (
    <Marker
      latitude={station.coordinates.latitude}
      longitude={station.coordinates.longitude}
      opacity={opacity.toString()}
    >
      <span className="pointer-events-none relative block h-5 w-5">
        {shouldPulse && (
          <span className="bg-destructive absolute inset-0 animate-ping rounded-full opacity-75" />
        )}
        <span className="bg-destructive relative block h-5 w-5 rounded-full border-2 border-white shadow-sm" />
      </span>
    </Marker>
  );
}
