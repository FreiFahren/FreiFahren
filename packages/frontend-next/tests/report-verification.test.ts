import { describe, expect, it, vi } from 'vitest';
import {
  evaluateReportChecks,
  failedCheck,
  isUsableFix,
} from '../src/components/report/report-verification';
import {
  runReportSubmission,
  showReportConfirmation,
  type LocationOutcome,
  type SubmissionPhase,
} from '../src/components/report/report-submission-flow';

const now = Date.parse('2026-01-01T12:00:00Z');
const station = { latitude: 52.5, longitude: 13.4 };
const near: LocationOutcome = {
  position: { lat: 52.5, lng: 13.4 },
  accuracy: 20,
  outcome: 'accurate',
};
const selection = { stationId: 'station', lineName: null, directionStationId: null };
const accepted = {
  reportId: 1,
  stationId: 'station',
  lineId: null,
  directionId: null,
  timestamp: new Date(now).toISOString(),
};
const evaluate = (location = near, history: Parameters<typeof evaluateReportChecks>[2] = []) =>
  evaluateReportChecks(station, location, history, now);

function flow(overrides: Partial<Parameters<typeof runReportSubmission>[1]> = {}) {
  const phases: SubmissionPhase[] = [];
  const deps = {
    resolveLocation: async () => near,
    mintToken: async () => ({ token: 'token', outcome: 'passed' as const }),
    verify: evaluate,
    send: vi.fn(async () => accepted),
    onVerified: vi.fn(),
    onPhase: (phase: SubmissionPhase) => phases.push(phase),
    ...overrides,
  };
  return { phases, deps, run: () => runReportSubmission(selection, deps) };
}

describe('Truthful verification outcomes', () => {
  it('attaches too_far to location, leaves activity untested, and never sends', async () => {
    const f = flow({
      resolveLocation: async () => ({ ...near, position: { lat: 53, lng: 13.4 } }),
    });
    await f.run();
    expect(f.deps.send).not.toHaveBeenCalled();
    expect(f.phases.at(-1)).toMatchObject({
      kind: 'rejected',
      checks: {
        location: { status: 'failed', reason: 'too_far' },
        activity: { status: 'skipped' },
      },
    });
    expect(f.phases.some((p) => 'checks' in p && p.checks.location.status === 'passed')).toBe(
      false,
    );
  });

  it.each([null, 3000, NaN, -1])(
    'never reports a passed location check for unusable accuracy %s',
    (accuracy) => {
      expect(evaluate({ ...near, accuracy }).location.status).toBe('unavailable');
      expect(isUsableFix(accuracy)).toBe(false);
    },
  );

  it('does not reject a coarse fix when its error radius overlaps the allowed area', () => {
    expect(
      evaluate({ ...near, position: { lat: 52.525, lng: 13.4 }, accuracy: 1000 }).location.status,
    ).toBe('passed');
  });

  it('keeps missing location neutral while still checking recent activity', () => {
    expect(evaluate({ position: null, accuracy: null, outcome: 'none' })).toEqual({
      location: { status: 'unavailable' },
      activity: { status: 'passed' },
    });
  });

  it('attaches recent-report limits to activity, not location', () => {
    const checks = evaluate(
      near,
      Array.from({ length: 4 }, () => ({ timestamp: now - 1000, coordinates: station })),
    );
    expect(checks.location.status).toBe('passed');
    expect(checks.activity).toEqual({ status: 'failed', reason: 'rate_limited' });
  });

  it('explains implausible travel on the recent-activity check', () => {
    expect(
      evaluate(near, [{ timestamp: now - 1000, coordinates: { latitude: 53, longitude: 13.4 } }])
        .activity,
    ).toEqual({ status: 'failed', reason: 'too_fast' });
  });

  it('never turns a failed or disabled spam check green', async () => {
    for (const outcome of ['failed', 'disabled'] as const) {
      const f = flow({ mintToken: async () => ({ token: undefined, outcome }) });
      await f.run();
      expect(f.phases.at(-1)).toMatchObject({
        checks: { device: { status: outcome === 'failed' ? 'failed' : 'not_required' } },
      });
      expect(f.deps.send).toHaveBeenCalledTimes(outcome === 'failed' ? 0 : 1);
    }
  });

  it('sends before showing results, waits for acknowledgement, and keeps confirmation separate', async () => {
    let acknowledge!: (value: typeof accepted) => void;
    let sending!: () => void;
    const started = new Promise<void>((resolve) => {
      sending = resolve;
    });
    const f = flow({
      send: vi.fn(
        () =>
          new Promise<typeof accepted>((resolve) => {
            acknowledge = resolve;
            sending();
          }),
      ),
    });
    const running = f.run();
    await started;
    expect(f.phases.at(-1)?.kind).toBe('sending');
    expect(showReportConfirmation(f.phases.at(-1)!)).toBe(f.phases.at(-1));
    acknowledge(accepted);
    await running;
    expect(f.phases.at(-1)).toMatchObject({
      kind: 'delivered',
      result: accepted,
      checks: {
        location: { status: 'passed' },
        device: { status: 'passed' },
        activity: { status: 'passed' },
      },
    });
  });

  it('only advances acknowledged reports and never resubmits when showing confirmation', async () => {
    const f = flow();
    await f.run();
    const delivered = f.phases.at(-1)!;
    expect(f.phases.some((phase) => phase.kind === 'success')).toBe(false);
    const confirmation = showReportConfirmation(delivered);
    expect(confirmation).toMatchObject({ kind: 'success', result: accepted });
    expect(showReportConfirmation(confirmation)).toBe(confirmation);
    expect(f.deps.send).toHaveBeenCalledTimes(1);
    const rejected = flow({ mintToken: async () => ({ token: undefined, outcome: 'failed' }) });
    await rejected.run();
    expect(showReportConfirmation(rejected.phases.at(-1)!)).toBe(rejected.phases.at(-1));
  });

  it('preserves the local-only delivery outcome for the confirmation screen', async () => {
    const f = flow({ send: async () => ({ ...accepted, local: true }) });
    await f.run();
    expect(f.phases.at(-1)).toEqual({
      kind: 'saved_locally',
      result: { ...accepted, local: true },
    });
    expect(f.phases.some((phase) => phase.kind === 'delivered' || phase.kind === 'success')).toBe(
      false,
    );
  });

  it('returns to the form after a send defect and rejects on verification exceptions', async () => {
    const delivery = flow({
      send: async () => {
        throw new Error('defect');
      },
    });
    await delivery.run();
    expect(delivery.phases.at(-1)).toEqual({ kind: 'form' });
    const verification = flow({
      resolveLocation: async () => {
        throw new Error('location');
      },
    });
    await verification.run();
    const last = verification.phases.at(-1)!;
    expect(last.kind).toBe('rejected');
    expect('checks' in last && failedCheck(last.checks)?.reason).toBe('verification_failed');
    expect(verification.deps.send).not.toHaveBeenCalled();
  });
});
