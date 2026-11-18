import { distanceMeters } from '@/lib/geo';

type Failed<Reason extends string> = { status: 'failed'; reason: Reason };

// Each row lists only the states it can reach, so a combination no row produces does not typecheck.
export type LocationCheck =
  { status: 'running' | 'passed' | 'unavailable' } | Failed<'too_far' | 'verification_failed'>;
export type DeviceCheck =
  { status: 'running' | 'passed' | 'not_required' } | Failed<'device_failed'>;
export type ActivityCheck =
  { status: 'pending' | 'passed' | 'skipped' } | Failed<'too_fast' | 'rate_limited'>;
export type VerificationChecks = {
  location: LocationCheck;
  device: DeviceCheck;
  activity: ActivityCheck;
};
type FailedCheck = Extract<VerificationChecks[keyof VerificationChecks], { status: 'failed' }>;
export type ReportRejection = FailedCheck['reason'];
export type Coordinates = { latitude: number; longitude: number };
export type ReportHistoryEntry = { timestamp: number; coordinates: Coordinates | null };
export type VerifyLocation = {
  position: { lat: number; lng: number } | null;
  accuracy: number | null;
};

export const MAX_REPORT_DISTANCE_M = 2000;
const TRAVEL_TOLERANCE_M = 500;
const TRAVEL_SPEED_M_PER_MS = 1000 / 60_000;
const REPORT_WINDOW_MS = 10 * 60_000;
export const MAX_REPORTS_PER_WINDOW = 4;

export const isUsableFix = (accuracy: number | null): boolean =>
  accuracy !== null &&
  Number.isFinite(accuracy) &&
  accuracy >= 0 &&
  accuracy <= MAX_REPORT_DISTANCE_M;

export function evaluateReportChecks(
  coordinates: Coordinates | undefined,
  location: VerifyLocation,
  history: ReportHistoryEntry[],
  now: number,
): Pick<VerificationChecks, 'location' | 'activity'> {
  const usable = coordinates && location.position && isUsableFix(location.accuracy);
  if (
    usable &&
    distanceMeters(
      location.position!.lat,
      location.position!.lng,
      coordinates.latitude,
      coordinates.longitude,
    ) -
      location.accuracy! >
      MAX_REPORT_DISTANCE_M
  ) {
    return { location: { status: 'failed', reason: 'too_far' }, activity: { status: 'pending' } };
  }
  const locationCheck: LocationCheck = { status: usable ? 'passed' : 'unavailable' };
  const last = history.at(-1);
  if (coordinates && last?.coordinates) {
    const distance = distanceMeters(
      last.coordinates.latitude,
      last.coordinates.longitude,
      coordinates.latitude,
      coordinates.longitude,
    );
    if (distance > TRAVEL_TOLERANCE_M + Math.max(0, now - last.timestamp) * TRAVEL_SPEED_M_PER_MS) {
      return { location: locationCheck, activity: { status: 'failed', reason: 'too_fast' } };
    }
  }
  const recent = history.filter((entry) => entry.timestamp > now - REPORT_WINDOW_MS);
  return {
    location: locationCheck,
    activity:
      recent.length >= MAX_REPORTS_PER_WINDOW
        ? { status: 'failed', reason: 'rate_limited' }
        : { status: 'passed' },
  };
}

export function failedCheck(checks: VerificationChecks): FailedCheck | undefined {
  return Object.values(checks).find((check): check is FailedCheck => check.status === 'failed');
}
