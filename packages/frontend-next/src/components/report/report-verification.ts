import { distanceMeters } from '@/lib/geo';

type Failed<Reason extends string> = { status: 'failed'; reason: Reason };

// Each row lists only the states it can reach, so a combination no row produces does not typecheck.
export type LocationCheck =
  { status: 'running' | 'passed' | 'unavailable' } | Failed<'too_far' | 'verification_failed'>;
export type DeviceCheck = { status: 'running' | 'passed' | 'not_required' | 'unavailable' };
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
// Only verified submissions carry a station coordinate (or null when the station was unknown).
export type ReportHistoryEntry = { timestamp: number; coordinates?: Coordinates | null };
export type VerifyLocation = {
  position: { lat: number; lng: number } | null;
  accuracy: number | null;
  timestamp?: number | null;
};

export const MAX_REPORT_DISTANCE_M = 2000;
export const MAX_FIX_AGE_MS = 30_000;

export const isFreshFix = (timestamp: number | null | undefined, now: number): boolean =>
  timestamp != null &&
  Number.isFinite(timestamp) &&
  timestamp <= now &&
  now - timestamp <= MAX_FIX_AGE_MS;

const TRAVEL_TOLERANCE_M = 500;
const TRAVEL_SPEED_M_PER_MS = 1000 / 60_000;
export const REPORT_WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 4;

export const isUsableFix = (accuracy: number | null): boolean =>
  accuracy !== null &&
  Number.isFinite(accuracy) &&
  accuracy >= 0 &&
  accuracy <= MAX_REPORT_DISTANCE_M;

export function checkLocation(
  coordinates: Coordinates | undefined,
  location: VerifyLocation,
  now: number,
): LocationCheck {
  const usable =
    coordinates &&
    location.position &&
    isUsableFix(location.accuracy) &&
    isFreshFix(location.timestamp, now);
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
    return { status: 'failed', reason: 'too_far' };
  }
  return { status: usable ? 'passed' : 'unavailable' };
}

export function lastSubmission(history: ReportHistoryEntry[]) {
  return history.filter((entry) => entry.coordinates !== undefined).at(-1);
}

export function evaluateReportChecks(
  coordinates: Coordinates | undefined,
  location: VerifyLocation,
  history: ReportHistoryEntry[],
  now: number,
): Pick<VerificationChecks, 'location' | 'activity'> {
  const locationCheck = checkLocation(coordinates, location, now);
  const recent = history.filter((entry) => entry.timestamp > now - REPORT_WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS_PER_WINDOW) {
    return { location: locationCheck, activity: { status: 'failed', reason: 'rate_limited' } };
  }
  if (locationCheck.status === 'failed') {
    return { location: locationCheck, activity: { status: 'skipped' } };
  }
  const last = lastSubmission(history);
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
  return { location: locationCheck, activity: { status: 'passed' } };
}

export function failedCheck(checks: VerificationChecks): FailedCheck | undefined {
  return Object.values(checks).find((check): check is FailedCheck => check.status === 'failed');
}
