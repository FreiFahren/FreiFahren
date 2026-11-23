import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resolveReportLocation } from '../src/components/report/report-location';
import { evaluateReportChecks } from '../src/components/report/report-verification';
import { runReportSubmission } from '../src/components/report/report-submission-flow';

const now = Date.parse('2026-11-23T10:00:00Z');
const station = { latitude: 52.5, longitude: 13.4 };
const distant = { position: { lat: 53, lng: 13.4 }, accuracy: 20, timestamp: now };
const near = { ...distant, position: { lat: 52.5, lng: 13.4 } };
const fix = (location = near) => ({
  coords: {
    latitude: location.position.lat,
    longitude: location.position.lng,
    accuracy: location.accuracy,
  },
  timestamp: location.timestamp,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

it('refreshes a precise but distant fix before rejecting, and accepts the corrected position', async () => {
  const refresh = vi.fn(async () => fix());
  const { location, diagnostics } = await resolveReportLocation(distant, station, refresh);
  expect(refresh).toHaveBeenCalledOnce();
  expect(evaluateReportChecks(station, location, [], Date.now()).location.status).toBe('passed');
  expect(diagnostics).toMatchObject({
    refreshReason: 'too_far',
    refreshOutcome: 'fresh',
    decision: 'passed',
    initialDistanceBand: '>5000',
    finalDistanceBand: '500',
  });
});

it('does not wait for a new fix when a fresh precise fix is already nearby', async () => {
  const refresh = vi.fn();
  const result = await resolveReportLocation(near, station, refresh);
  expect(refresh).not.toHaveBeenCalled();
  expect(result.diagnostics).toMatchObject({ outcome: 'accurate', refreshReason: 'none' });
});

it.each([
  ['stale', { ...distant, timestamp: now - 30_001 }],
  ['coarse', { ...distant, accuracy: 3000 }],
  ['stale', { ...distant, timestamp: now + 1000 }],
])('refreshes an existing %s fix', async (reason, initial) => {
  const refresh = vi.fn(async () => fix());
  expect((await resolveReportLocation(initial, station, refresh)).diagnostics.refreshReason).toBe(
    reason,
  );
  expect(refresh).toHaveBeenCalledOnce();
});

it.each(['unavailable', 'coarse', 'stale', 'exception', 'timeout'] as const)(
  'sends the report when the confirming fix is %s, without reusing the distant fix',
  async (scenario) => {
    const refresh = vi.fn(async () => {
      if (scenario === 'exception') throw new Error('location unavailable');
      if (scenario === 'timeout') return new Promise<null>(() => {});
      if (scenario === 'unavailable') return null;
      return fix({
        ...distant,
        accuracy: scenario === 'coarse' ? 5000 : 20,
        timestamp: scenario === 'stale' ? now - 60_000 : now,
      });
    });
    const send = vi.fn(async () => ({ stationId: 'station', lineId: null, directionId: null }));
    const onVerified = vi.fn();
    const running = runReportSubmission(
      { stationId: 'station', lineName: null, directionStationId: null },
      {
        resolveLocation: async () =>
          (await resolveReportLocation(distant, station, refresh)).location,
        mintToken: async () => ({ token: undefined, outcome: 'failed' }),
        verify: (location) => evaluateReportChecks(station, location, [], Date.now()),
        send,
        onVerified,
        onPhase: vi.fn(),
      },
    );
    if (scenario === 'timeout') await vi.advanceTimersByTimeAsync(8000);
    await running;
    expect(send).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(onVerified.mock.calls[0][0].position).toBeNull();
  },
);

it('still blocks a fresh accurate confirming fix that remains too far away', async () => {
  const { location, diagnostics } = await resolveReportLocation(distant, station, async () =>
    fix(distant),
  );
  expect(diagnostics.decision).toBe('too_far');
  expect(evaluateReportChecks(station, location, [], now).location).toEqual({
    status: 'failed',
    reason: 'too_far',
  });
});

it('does not enforce distance when a fix expires before verification', () => {
  expect(evaluateReportChecks(station, distant, [], now + 30_001).location.status).toBe(
    'unavailable',
  );
});
