import { useStations } from '@/api/transit';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { distanceMeters } from '@/lib/geo';
import { safeLocalStorage } from '@/lib/safe-storage';

export type ReportRejection = 'too_far' | 'too_fast' | 'rate_limited';

const MAX_REPORT_DISTANCE_M = 2000;
const TRAVEL_TOLERANCE_M = 500;
const TRAVEL_SPEED_M_PER_MS = 1000 / 60_000;
const REPORT_WINDOW_MS = 10 * 60_000;
const MAX_REPORTS_PER_WINDOW = 4;
const STORAGE_KEY = 'reportHistory';

type Coordinates = { latitude: number; longitude: number };
type ReportHistoryEntry = {
  timestamp: number;
  coordinates: Coordinates | null;
};

function isCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== 'object' || value === null) return false;
  const coordinates = value as Coordinates;
  return (
    Number.isFinite(coordinates.latitude) &&
    Math.abs(coordinates.latitude) <= 90 &&
    Number.isFinite(coordinates.longitude) &&
    Math.abs(coordinates.longitude) <= 180
  );
}

function readHistory(): ReportHistoryEntry[] {
  try {
    const entries: unknown = JSON.parse(safeLocalStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(entries)) return [];
    return entries.filter(
      (entry): entry is ReportHistoryEntry =>
        typeof entry === 'object' &&
        entry !== null &&
        Number.isFinite(entry.timestamp) &&
        entry.timestamp >= 0 &&
        (entry.coordinates === null || isCoordinates(entry.coordinates)),
    );
  } catch {
    return [];
  }
}

/**
 * Pre-submission guardrails for the report form, kept out of the form itself.
 * `verify` returns the first failing rule, or null when the report may be sent.
 */
export function useReportVerification() {
  const { position } = useGeolocation();
  const { data: stations } = useStations();

  const verify = (stationId: string): ReportRejection | null => {
    const coordinates = stations?.[stationId]?.coordinates;
    if (
      coordinates &&
      position &&
      distanceMeters(position.lat, position.lng, coordinates.latitude, coordinates.longitude) >
        MAX_REPORT_DISTANCE_M
    ) {
      return 'too_far';
    }

    const now = Date.now();
    const history = readHistory();
    const last = history.at(-1);
    if (coordinates && last?.coordinates) {
      const distance = distanceMeters(
        last.coordinates.latitude,
        last.coordinates.longitude,
        coordinates.latitude,
        coordinates.longitude,
      );
      const elapsed = Math.max(0, now - last.timestamp);
      if (distance > TRAVEL_TOLERANCE_M + elapsed * TRAVEL_SPEED_M_PER_MS) return 'too_fast';
    }

    const recent = history.filter((entry) => entry.timestamp > now - REPORT_WINDOW_MS);
    return recent.length >= MAX_REPORTS_PER_WINDOW ? 'rate_limited' : null;
  };

  // An attempt establishes the user's claimed location even if the API request fails.
  const recordSubmission = (stationId: string): void => {
    const entry = {
      timestamp: Date.now(),
      coordinates: stations?.[stationId]?.coordinates ?? null,
    };
    const history = [...readHistory(), entry].slice(-MAX_REPORTS_PER_WINDOW);
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  };

  return { verify, recordSubmission };
}
