import { useStations } from '@/api/transit';
import { safeLocalStorage } from '@/lib/safe-storage';
import {
  evaluateReportChecks,
  MAX_REPORTS_PER_WINDOW,
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
        (entry.coordinates === null || isCoordinates(entry.coordinates)),
    );
  } catch {
    return [];
  }
}

export function useReportVerification() {
  const { data: stations } = useStations();
  const verify = (stationId: string, location: VerifyLocation) =>
    evaluateReportChecks(stations?.[stationId]?.coordinates, location, readHistory(), Date.now());

  const recordSubmission = (stationId: string) => {
    const history = [
      ...readHistory(),
      {
        timestamp: Date.now(),
        coordinates: stations?.[stationId]?.coordinates ?? null,
      },
    ].slice(-MAX_REPORTS_PER_WINDOW);
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  };
  return { verify, recordSubmission };
}
