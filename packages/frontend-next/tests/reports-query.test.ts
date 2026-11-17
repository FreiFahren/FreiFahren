import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const requests: URL[] = [];
const observation = {
  stationId: 'station',
  lineId: null,
  directionId: null,
  timestamp: '2024-01-15T22:32:00.000Z',
  expiresAt: '2024-01-15T23:15:00.000Z',
  isPredicted: false,
};
const prediction = { ...observation, expiresAt: null, isPredicted: true };

vi.mock('../src/api/client', () => ({
  API_URL: 'https://api.test',
  fetchJson: async (path: string) => {
    const url = new URL(path, 'https://api.test');
    requests.push(url);
    return url.searchParams.get('mode') === 'live' ? [observation, prediction] : [observation];
  },
}));
vi.mock('../src/lib/city', () => ({ currentCitySlug: 'berlin' }));
vi.mock('../src/lib/turnstile', () => ({
  getTurnstileToken: async () => undefined,
  TURNSTILE_TOKEN_HEADER: 'cf-turnstile-response',
}));
vi.mock('../src/lib/error-monitoring', () => ({
  captureIssue: () => {},
  traceAction: () => {},
}));
vi.mock('../src/api/transit', () => ({ useLines: () => ({ data: [] }) }));

const { HOUR_MS, DAY_MS, reportsQueryOptions, stationReportCountQueryOptions } =
  await import('../src/api/reports');
const client = new QueryClient();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  client.clear();
  requests.length = 0;
  vi.useRealTimers();
});

describe('Live reports and history cache isolation', () => {
  it.each(['live first', 'history first'])(
    'keeps fallback predictions out of cached history (%s)',
    async (order) => {
      const liveOptions = reportsQueryOptions({ mode: 'live' });
      const historyOptions = reportsQueryOptions({ mode: 'history', fromAgo: HOUR_MS, toAgo: 0 });
      if (order === 'live first') await client.fetchQuery(liveOptions);
      else await client.fetchQuery(historyOptions);

      expect(await client.fetchQuery(liveOptions)).toEqual([observation, prediction]);
      expect(await client.fetchQuery(historyOptions)).toEqual([observation]);
      expect(requests).toHaveLength(2);
      expect(client.getQueryData(liveOptions.queryKey)).toEqual([observation, prediction]);
      expect(client.getQueryData(historyOptions.queryKey)).toEqual([observation]);
    },
  );

  it('does not reuse a persisted report query from before the modes were separated', async () => {
    client.setQueryData(['reports', HOUR_MS, 0], [observation, prediction]);
    expect(
      await client.fetchQuery(reportsQueryOptions({ mode: 'history', fromAgo: HOUR_MS, toAgo: 0 })),
    ).toEqual([observation]);
    expect(requests).toHaveLength(1);
  });

  it.each([-90, 90])(
    'sends no client timestamps for live mode with %s seconds clock skew',
    async (seconds) => {
      vi.setSystemTime(new Date(Date.parse('2024-01-15T23:30:00Z') + seconds * 1000));
      await client.fetchQuery(reportsQueryOptions({ mode: 'live' }));
      expect(requests[0].search).toBe('?mode=live');
    },
  );

  it('keeps both day-history slices and station history on the historical policy', async () => {
    vi.setSystemTime(new Date('2024-01-15T23:30:00Z'));
    await client.fetchQuery(reportsQueryOptions({ mode: 'live' }));
    for (const options of [
      reportsQueryOptions({ mode: 'history', fromAgo: HOUR_MS, toAgo: 0 }),
      reportsQueryOptions({ mode: 'history', fromAgo: DAY_MS, toAgo: HOUR_MS }),
      stationReportCountQueryOptions('station'),
    ]) {
      expect(await client.fetchQuery(options)).toEqual([observation]);
    }
    for (const request of requests.slice(1)) {
      expect(request.searchParams.get('mode')).toBe('history');
      expect(request.searchParams.has('from')).toBe(true);
      expect(request.searchParams.has('to')).toBe(true);
    }
  });
});
