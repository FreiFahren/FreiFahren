import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReportVerification } from '../src/components/report/useReportVerification';

const { stations } = vi.hoisted(() => ({
  stations: {
    ahrensfelde: { coordinates: { latitude: 52.572, longitude: 13.565 } },
    rosenthaler: { coordinates: { latitude: 52.53, longitude: 13.401 } },
    potsdam: { coordinates: { latitude: 52.391, longitude: 13.067 } },
  },
}));
vi.mock('@/api/transit', () => ({ useStations: () => ({ data: stations }) }));

const start = Date.UTC(2026, 0, 1, 12);
const minute = 60_000;
const nearRosenthaler = { position: { lat: 52.53, lng: 13.401 }, accuracy: 20 };

describe('report attempt history', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
    const items = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('allows a station correction on the fourth attempt and blocks the fifth across form visits', () => {
    const form = useReportVerification();
    for (let i = 0; i < 3; i++) {
      expect(form.verify('ahrensfelde', nearRosenthaler).location).toEqual({
        status: 'failed',
        reason: 'too_far',
      });
    }
    expect(JSON.parse(localStorage.getItem('reportHistory')!)).toEqual(
      Array.from({ length: 3 }, () => ({ timestamp: start })),
    );
    const reopened = useReportVerification();
    expect(reopened.verify('rosenthaler', nearRosenthaler).activity.status).toBe('passed');
    reopened.recordSubmission('rosenthaler');
    expect(reopened.verify('rosenthaler', nearRosenthaler).activity).toEqual({
      status: 'failed',
      reason: 'rate_limited',
    });
  });

  it('releases a slot exactly ten minutes after the oldest attempt, even after a blocked distant retry', () => {
    const form = useReportVerification();
    for (let i = 0; i < 4; i++) {
      vi.setSystemTime(start + i * minute);
      form.verify('ahrensfelde', nearRosenthaler);
    }
    vi.setSystemTime(start + 10 * minute - 1);
    expect(form.verify('ahrensfelde', nearRosenthaler).activity).toEqual({
      status: 'failed',
      reason: 'rate_limited',
    });
    vi.setSystemTime(start + 10 * minute);
    expect(form.verify('rosenthaler', nearRosenthaler).activity.status).toBe('passed');
    form.recordSubmission('rosenthaler');
    expect(form.verify('rosenthaler', nearRosenthaler).activity).toMatchObject({
      reason: 'rate_limited',
    });
  });

  it('preserves a pre-update travel reference after its rate-limit window expires', () => {
    localStorage.setItem(
      'reportHistory',
      JSON.stringify([{ timestamp: start, coordinates: stations.potsdam.coordinates }]),
    );
    vi.setSystemTime(start + 11 * minute);
    const form = useReportVerification();
    form.verify('ahrensfelde', nearRosenthaler);
    expect(form.verify('rosenthaler', nearRosenthaler).activity).toEqual({
      status: 'failed',
      reason: 'too_fast',
    });
  });
});
