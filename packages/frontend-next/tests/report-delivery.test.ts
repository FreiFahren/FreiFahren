import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
  useMutation: (options: unknown) => options,
}));
vi.mock('../src/api/transit', () => ({ useLines: () => ({ data: [] }) }));
vi.mock('../src/api/client', () => ({ API_URL: 'https://api.test', fetchJson: vi.fn() }));
vi.mock('../src/lib/city', () => ({ currentCitySlug: 'test' }));
vi.mock('../src/lib/turnstile', () => ({ TURNSTILE_TOKEN_HEADER: 'cf-turnstile-response' }));
vi.mock('../src/lib/error-monitoring', () => ({
  captureIssue: vi.fn(),
  traceAction: (_name: string, action: () => unknown) => action(),
}));

import { useSubmitReport, type SubmitReportResponse } from '../src/api/reports';
const input = { stationId: 'station', lineName: null, directionStationId: null };
const submit = () => {
  // React Query is mocked above to expose the mutation without a React renderer.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const mutation = useSubmitReport() as unknown as {
    mutationFn: (input: typeof input) => Promise<SubmitReportResponse>;
  };
  return mutation.mutationFn(input);
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Delivery acknowledgement', () => {
  it('returns a server-acknowledged report as delivered', async () => {
    const report = {
      reportId: 1,
      stationId: 'station',
      lineId: null,
      directionId: null,
      timestamp: '2026-01-01T12:00:00Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(report))),
    );
    expect(await submit()).toEqual(report);
  });

  it.each([400, 503])('does not claim delivery after HTTP %s', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status })),
    );
    expect(await submit()).toMatchObject({ local: true, stationId: 'station' });
  });

  it('keeps malformed JSON and disconnected requests recoverable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{')),
    );
    expect(await submit()).toMatchObject({ local: true });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    expect(await submit()).toMatchObject({ local: true });
  });

  it('bounds a hanging request and clears the timer afterward', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, options: RequestInit) =>
          new Promise((_resolve, reject) =>
            options.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
          ),
      ),
    );
    const result = submit();
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await result).toMatchObject({ local: true });
    expect(vi.getTimerCount()).toBe(0);
  });
});
