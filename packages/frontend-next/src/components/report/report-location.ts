import type { GeolocationFix } from '@/contexts/Geolocation.context';
import { distanceMeters } from '@/lib/geo';
import type { LocationOutcome } from './report-submission-flow';
import {
  checkLocation,
  isFreshFix,
  isUsableFix,
  type Coordinates,
  type VerifyLocation,
} from './report-verification';

const REFRESH_TIMEOUT_MS = 8_000;
export type LocationDiagnostics = {
  outcome: LocationOutcome['outcome'];
  decision: 'passed' | 'unavailable' | 'too_far';
  refreshReason: 'none' | 'stale' | 'coarse' | 'too_far';
  refreshOutcome: 'not_needed' | 'fresh' | 'stale' | 'coarse' | 'unavailable';
  initialAccuracyBand: string;
  initialAgeBand: string;
  initialDistanceBand: string;
  finalAccuracyBand: string;
  finalAgeBand: string;
  finalDistanceBand: string;
};

function band(value: number | null | undefined, limits: number[]): string {
  if (value == null || !Number.isFinite(value) || value < 0) return 'unknown';
  return limits.find((limit) => value <= limit)?.toString() ?? `>${limits.at(-1)}`;
}

function measurements(location: VerifyLocation, station: Coordinates | undefined, now: number) {
  return {
    accuracy: band(location.accuracy, [100, 500, 2000]),
    age: band(location.timestamp == null ? null : now - location.timestamp, [5000, 30000, 60000]),
    distance: band(
      location.position && station
        ? distanceMeters(
            location.position.lat,
            location.position.lng,
            station.latitude,
            station.longitude,
          )
        : null,
      [500, 2000, 5000],
    ),
  };
}

// A location that looks precise can still be old or misplaced. Confirm a distant fix once,
// and never fall back to that old fix if the fresh request fails.
export async function resolveReportLocation(
  initial: VerifyLocation,
  station: Coordinates | undefined,
  refresh: () => Promise<GeolocationFix | null>,
): Promise<{ location: LocationOutcome; diagnostics: LocationDiagnostics }> {
  const now = Date.now();
  const first = measurements(initial, station, now);
  let candidate = initial;
  let refreshReason: LocationDiagnostics['refreshReason'] = 'none';
  let refreshOutcome: LocationDiagnostics['refreshOutcome'] = 'not_needed';
  let outcome: LocationOutcome['outcome'] = initial.position ? 'accurate' : 'none';

  if (initial.position) {
    if (!isFreshFix(initial.timestamp, now)) refreshReason = 'stale';
    else if (!isUsableFix(initial.accuracy)) refreshReason = 'coarse';
    else if (checkLocation(station, initial, now).status === 'failed') refreshReason = 'too_far';
  }
  if (refreshReason !== 'none') {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let fix: GeolocationFix | null;
    try {
      fix = await Promise.race([
        refresh(),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), REFRESH_TIMEOUT_MS);
        }),
      ]);
    } catch {
      fix = null;
    } finally {
      clearTimeout(timer);
    }
    candidate = fix
      ? {
          position: { lat: fix.coords.latitude, lng: fix.coords.longitude },
          accuracy: fix.coords.accuracy,
          timestamp: fix.timestamp,
        }
      : { position: null, accuracy: null, timestamp: null };
    if (!fix) {
      refreshOutcome = 'unavailable';
      outcome = 'none';
    } else if (!isFreshFix(fix.timestamp, Date.now())) {
      refreshOutcome = 'stale';
      outcome = 'stale';
    } else if (!isUsableFix(fix.coords.accuracy)) {
      refreshOutcome = 'coarse';
      outcome = 'coarse';
    } else {
      refreshOutcome = 'fresh';
      outcome = 'refined';
    }
  }
  const final = measurements(candidate, station, Date.now());
  const usable =
    candidate.position &&
    isUsableFix(candidate.accuracy) &&
    isFreshFix(candidate.timestamp, Date.now());
  const location: LocationOutcome = usable
    ? { ...candidate, outcome }
    : { position: null, accuracy: null, timestamp: null, outcome };
  const check = checkLocation(station, location, Date.now());
  let decision: LocationDiagnostics['decision'] = 'unavailable';
  if (check.status === 'failed') decision = 'too_far';
  else if (check.status === 'passed') decision = 'passed';
  return {
    location,
    diagnostics: {
      outcome,
      decision,
      refreshReason,
      refreshOutcome,
      initialAccuracyBand: first.accuracy,
      initialAgeBand: first.age,
      initialDistanceBand: first.distance,
      finalAccuracyBand: final.accuracy,
      finalAgeBand: final.age,
      finalDistanceBand: final.distance,
    },
  };
}
