import { useStations } from '@/api/transit';
import { safeLocalStorage } from '@/lib/safe-storage';
import {
  evaluateReportChecks,
  lastSubmission,
  REPORT_WINDOW_MS,
  type Coordinates,
  type ReportHistoryEntry,
  type VerifyLocation,
} from './report-verification';

const STORAGE_KEY = 'reportHistory';

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
        (entry.coordinates === undefined ||
          entry.coordinates === null ||
          isCoordinates(entry.coordinates)),
    );
  } catch {
    return [];
  }
}

function recordAttempt(entry: ReportHistoryEntry) {
  const history = [...readHistory(), entry];
  const last = lastSubmission(history);
  // A verified station can still rule out implausible travel after the attempt window expires.
  const retained = history.filter(
    (attempt) => attempt === last || attempt.timestamp > entry.timestamp - REPORT_WINDOW_MS,
  );
  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(retained));
}

export function useReportVerification() {
  const { data: stations } = useStations();
  const verify = (stationId: string, location: VerifyLocation) => {
    const now = Date.now();
    const checks = evaluateReportChecks(
      stations?.[stationId]?.coordinates,
      location,
      readHistory(),
      now,
    );
    if (
      checks.location.status === 'failed' &&
      checks.location.reason === 'too_far' &&
      checks.activity.status !== 'failed'
    ) {
      recordAttempt({ timestamp: now });
    }
    return checks;
  };

  const recordSubmission = (stationId: string) =>
    recordAttempt({
      timestamp: Date.now(),
      coordinates: stations?.[stationId]?.coordinates ?? null,
    });

  return { verify, recordSubmission };
}
