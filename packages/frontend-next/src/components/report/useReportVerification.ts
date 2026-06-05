import { useStations } from '@/api/transit';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { distanceMeters } from '@/lib/geo';

export type ReportRejection = 'too_soon' | 'too_far';

const MAX_REPORT_DISTANCE_M = 1500;
const MIN_REPORT_INTERVAL_MS = 15 * 60 * 1000;
const STORAGE_KEY = 'lastReportAt';

function readLastReportAt(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeLastReportAt(timestamp: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(timestamp));
  } catch {
    // Private mode / storage unavailable: skip.
  }
}

/**
 * Pre-submission guardrails for the report form, kept out of the form itself.
 * `verify` returns the first failing rule, or null when the report may be sent.
 * Disabled entirely in dev so local testing is never blocked.
 */
export function useReportVerification() {
  const { position } = useGeolocation();
  const { data: stations } = useStations();

  const verify = (stationId: string): ReportRejection | null => {
    if (import.meta.env.DEV) return null;

    if (position) {
      const station = stations?.[stationId];
      if (station) {
        const distance = distanceMeters(
          position.lat,
          position.lng,
          station.coordinates.latitude,
          station.coordinates.longitude,
        );
        if (distance > MAX_REPORT_DISTANCE_M) return 'too_far';
      }
    }

    const lastReportAt = readLastReportAt();
    if (lastReportAt !== null && Date.now() - lastReportAt < MIN_REPORT_INTERVAL_MS) {
      return 'too_soon';
    }

    return null;
  };

  const recordSubmission = () => writeLastReportAt(Date.now());

  return { verify, recordSubmission };
}
