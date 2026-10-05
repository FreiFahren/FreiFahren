import { useStations } from '@/api/transit';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { distanceMeters } from '@/lib/geo';
import { safeLocalStorage } from '@/lib/safe-storage';
import { isPreviewBuild } from '@/lib/utils';

export type ReportRejection = 'too_soon' | 'too_far';

const MAX_REPORT_DISTANCE_M = 2000;
const MIN_REPORT_INTERVAL_MS = 15 * 60 * 1000;
const STORAGE_KEY = 'lastReportAt';

type LastReport = { at: number; stationId: string };

function readLastReport(): LastReport | null {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  if (raw.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'at' in parsed &&
        'stationId' in parsed &&
        typeof parsed.at === 'number' &&
        Number.isFinite(parsed.at) &&
        typeof parsed.stationId === 'string'
      ) {
        return { at: parsed.at, stationId: parsed.stationId };
      }
    } catch {
      return null;
    }
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? { at: value, stationId: '' } : null;
}

function writeLastReport(report: LastReport): void {
  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(report));
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
    if (import.meta.env.DEV || isPreviewBuild) return null;

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

    const lastReport = readLastReport();
    if (
      lastReport !== null &&
      Date.now() - lastReport.at < MIN_REPORT_INTERVAL_MS &&
      (lastReport.stationId === '' || lastReport.stationId === stationId)
    ) {
      return 'too_soon';
    }

    return null;
  };

  const recordSubmission = (reportedStationId: string) =>
    writeLastReport({ at: Date.now(), stationId: reportedStationId });

  return { verify, recordSubmission };
}
