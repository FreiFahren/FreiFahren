import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({}),
  useMutation: (options: unknown) => options,
}));
vi.mock('../src/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../src/api/transit', () => ({ useLines: () => ({ data: [] }) }));
vi.mock('../src/api/client', () => ({ API_URL: 'https://api.test', fetchJson: vi.fn() }));
vi.mock('../src/lib/city', () => ({ currentCitySlug: 'test' }));
vi.mock('../src/lib/turnstile', () => ({ TURNSTILE_TOKEN_HEADER: 'cf-turnstile-response' }));
vi.mock('../src/lib/error-monitoring', () => ({
  captureIssue: vi.fn(),
  traceAction: (_name: string, action: () => unknown) => action(),
}));

import { track } from '../src/lib/analytics';
import { useSubmitReport, type SubmitReportResponse } from '../src/api/reports';
const input = {
  stationId: 'station',
  lineName: null,
  directionStationId: null,
  attemptId: 'attempt-1',
};
const submit = () => {
  // React Query is mocked above to expose the mutation without a React renderer.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const mutation = useSubmitReport() as unknown as {
    mutationFn: (input: typeof input) => Promise<SubmitReportResponse>;
  };
  return mutation.mutationFn(input);
};

afterEach(() => {
  vi.clearAllMocks();
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
    expect(track).toHaveBeenCalledWith(
      'report_delivery_completed',
      expect.objectContaining({
        attemptId: 'attempt-1',
        outcome: 'received',
        tokenPresent: false,
      }),
    );
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).not.toHaveProperty('cf-turnstile-response');
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({
      attemptId: input.attemptId,
    });
  });

  it.each([400, 503])('does not claim delivery after HTTP %s', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status })),
    );
    expect(await submit()).toMatchObject({ local: true, stationId: 'station' });
    expect(track).toHaveBeenCalledWith(
      'report_delivery_completed',
      expect.objectContaining({
        attemptId: 'attempt-1',
        outcome: 'saved_locally',
        reason: 'http_error',
        status,
      }),
    );
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
    expect(track).toHaveBeenCalledWith(
      'report_delivery_completed',
      expect.objectContaining({
        outcome: 'saved_locally',
        reason: 'timeout',
        durationMs: 15_000,
      }),
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});
