import type { SubmitReportResponse } from '@/api/reports';
import { failedCheck, type VerificationChecks } from './report-verification';

export type ReportSelection = {
  stationId: string;
  lineName: string | null;
  directionStationId: string | null;
};
// `delivered` still shows the checks; `success` and `saved_locally` are the two confirmation screens,
// one per delivery outcome, so no screen has to read a flag to know which one it is.
export type SubmissionPhase =
  | { kind: 'form' }
  | {
      kind: 'verifying' | 'sending' | 'rejected';
      selection: ReportSelection;
      checks: VerificationChecks;
    }
  | {
      kind: 'delivered';
      selection: ReportSelection;
      checks: VerificationChecks;
      result: SubmitReportResponse;
    }
  | { kind: 'success'; result: SubmitReportResponse }
  | { kind: 'saved_locally'; result: SubmitReportResponse };
export type LocationOutcome = {
  position: { lat: number; lng: number } | null;
  accuracy: number | null;
  timestamp?: number | null;
  outcome: 'accurate' | 'refined' | 'coarse' | 'stale' | 'none';
};
export type DeviceOutcome =
  | { outcome: 'passed'; token: string }
  | { outcome: 'failed' | 'unavailable' | 'disabled'; token: undefined };

function deviceCheck(device: DeviceOutcome): VerificationChecks['device'] {
  if (device.outcome === 'disabled') return { status: 'not_required' };
  if (device.token) return { status: 'passed' };
  // The server assesses reports whose token check could not complete.
  return { status: 'unavailable' };
}

type Dependencies = {
  signal?: AbortSignal;
  resolveLocation: () => Promise<LocationOutcome>;
  mintToken: () => Promise<DeviceOutcome>;
  verify: (location: LocationOutcome) => Pick<VerificationChecks, 'location' | 'activity'>;
  send: (token: string | undefined) => Promise<SubmitReportResponse>;
  onVerified: (location: LocationOutcome, device: DeviceOutcome) => void;
  onPhase: (phase: SubmissionPhase) => void;
};

// A check carries its own failure reason, so a location rejection cannot be displayed on another row.
export async function runReportSubmission(selection: ReportSelection, deps: Dependencies) {
  let checks: VerificationChecks = {
    location: { status: 'running' },
    device: { status: 'running' },
    activity: { status: 'pending' },
  };
  const mark = (patch: Partial<VerificationChecks>) => {
    if (deps.signal?.aborted) return;
    checks = { ...checks, ...patch };
    deps.onPhase({ kind: 'verifying', selection, checks });
  };
  mark({});
  const [location, device] = await Promise.all([
    deps
      .resolveLocation()
      .then((location) => {
        if (!deps.signal?.aborted) mark(deps.verify(location));
        return location;
      })
      .catch(() => {
        mark({ location: { status: 'failed', reason: 'verification_failed' } });
        return null;
      }),
    deps
      .mintToken()
      .catch((): DeviceOutcome => ({ token: undefined, outcome: 'unavailable' }))
      .then((device) => {
        mark({ device: deviceCheck(device) });
        return device;
      }),
  ]);
  if (deps.signal?.aborted) return;
  if (failedCheck(checks) || !location) {
    // A check that never ran says so, rather than leaving `pending` to mean two things.
    if (checks.activity.status === 'pending') {
      checks = { ...checks, activity: { status: 'skipped' } };
    }
    deps.onPhase({ kind: 'rejected', selection, checks });
    return;
  }
  deps.onVerified(location, device);
  deps.onPhase({ kind: 'sending', selection, checks });
  try {
    const result = await deps.send(device.token);
    if (deps.signal?.aborted) return;
    deps.onPhase(
      result.local
        ? { kind: 'saved_locally', result }
        : { kind: 'delivered', selection, checks, result },
    );
  } catch {
    if (deps.signal?.aborted) return;
    // `send` resolves for every delivery outcome, including an unconfirmed one, so only a defect
    // lands here. The form is the one state the reporter can always recover from.
    deps.onPhase({ kind: 'form' });
  }
}

// The reading interval only controls navigation. Delivery has already finished.
export function showReportConfirmation(phase: SubmissionPhase): SubmissionPhase {
  return phase.kind === 'delivered' ? { kind: 'success', result: phase.result } : phase;
}
