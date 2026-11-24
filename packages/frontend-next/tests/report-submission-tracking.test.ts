import { afterEach, expect, it, vi } from 'vitest';

const { getToken, effects, cleanups } = vi.hoisted(() => ({
  getToken: vi.fn(),
  cleanups: [] as (() => void)[],
  effects: [] as (() => void | (() => void))[],
}));

vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useState: () => [{ kind: 'form' }, vi.fn()],
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
}));
vi.mock('../src/api/transit', () => ({ useStations: () => ({ data: {} }) }));
vi.mock('../src/api/reports', () => ({ useSubmitReport: () => ({ mutateAsync: send }) }));
vi.mock('../src/contexts/Geolocation.context', () => ({
  useGeolocation: () => ({ position: null, status: 'idle', accuracy: null }),
}));
vi.mock('../src/components/report/useReportVerification', () => ({
  useReportVerification: () => ({
    verify: () => ({ location: { status: 'unavailable' }, activity: { status: 'passed' } }),
    recordSubmission: vi.fn(),
  }),
}));
vi.mock('../src/lib/analytics', () => ({ track: vi.fn() }));
vi.mock('../src/lib/error-monitoring', () => ({ captureIssue: vi.fn() }));
vi.mock('../src/lib/haptics', () => ({ notifySuccess: vi.fn() }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: {}, getFeatureFlagVariant: vi.fn() }));
vi.mock('../src/lib/turnstile', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/turnstile')>()),
  isTurnstileConfigured: () => true,
  getTurnstileToken: getToken,
}));

import { useReportSubmission } from '../src/components/report/use-report-submission';
import { track } from '../src/lib/analytics';
import { captureIssue } from '../src/lib/error-monitoring';
import { TurnstileError } from '../src/lib/turnstile';

const send = vi.fn(
  async (input: { stationId: string; attemptId?: string; turnstileToken?: string }) => ({
    stationId: input.stationId,
    lineId: null,
    directionId: null,
  }),
);
const selection = { stationId: 'station', lineName: null, directionStationId: null };

function runEarlyEffects() {
  effects.splice(0).forEach((effect) => {
    const cleanup = effect();
    if (cleanup) cleanups.push(cleanup);
  });
}

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  getToken.mockReset();
  send.mockClear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

it('correlates a visible token timeout with one tokenless fallback submission', async () => {
  getToken.mockRejectedValue(new TurnstileError('timeout', 'token_timeout'));
  const submission = useReportSubmission();
  const earlyContainer = {} as HTMLDivElement;
  const checksContainer = {} as HTMLDivElement;
  submission.earlyTurnstileContainerRef.current = earlyContainer;
  runEarlyEffects();
  submission.submit(selection);
  const signal = new AbortController().signal;
  await submission.start(checksContainer, signal);

  const attemptId = send.mock.calls[0]?.[0]?.attemptId;
  expect(attemptId).toEqual(expect.any(String));
  expect(send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ turnstileToken: undefined, attemptId }),
  );
  expect(getToken).toHaveBeenCalledTimes(2);
  expect(getToken.mock.calls[0]?.[1]).toMatchObject({ container: earlyContainer });
  expect(getToken.mock.calls[1]?.[1]).toMatchObject({ container: checksContainer });
  expect(track).toHaveBeenCalledWith('report_started', { stationId: 'station', attemptId });
  expect(track).toHaveBeenCalledWith(
    'report_turnstile_completed',
    expect.objectContaining({
      attemptId,
      outcome: 'failed',
      reason: 'token_timeout',
      timeoutMs: 20_000,
      earlyTokenUsed: false,
    }),
  );
  expect(captureIssue).toHaveBeenCalledWith(
    'Turnstile token could not be obtained',
    expect.objectContaining({ attemptId, reason: 'token_timeout' }),
  );
  expect(track).toHaveBeenCalledWith('report_submitted', expect.objectContaining({ attemptId }));
  expect(vi.mocked(track).mock.calls.map(([event]) => event)).not.toContain('report_rejected');
});

it('reuses a fresh token once and does not double-track it during effect replay', async () => {
  getToken.mockResolvedValue('early-token');
  const submission = useReportSubmission();
  const earlyContainer = {} as HTMLDivElement;
  submission.earlyTurnstileContainerRef.current = earlyContainer;
  runEarlyEffects();
  await vi.waitFor(() => expect(getToken).toHaveResolved());

  submission.submit(selection);
  const first = new AbortController();
  const staleRun = submission.start({} as HTMLDivElement, first.signal);
  first.abort();
  await Promise.all([
    staleRun,
    submission.start({} as HTMLDivElement, new AbortController().signal),
  ]);

  expect(getToken).toHaveBeenCalledExactlyOnceWith(
    'submit-report',
    expect.objectContaining({ container: earlyContainer }),
  );
  expect(send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ turnstileToken: 'early-token' }),
  );
  expect(track).toHaveBeenCalledWith(
    'report_turnstile_completed',
    expect.objectContaining({ outcome: 'passed', earlyTokenUsed: true }),
  );
  expect(
    vi.mocked(track).mock.calls.filter(([event]) => event === 'report_turnstile_completed'),
  ).toHaveLength(1);
});

it('refreshes an early token after the four minute reuse limit', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  getToken.mockResolvedValueOnce('early-token').mockResolvedValueOnce('fresh-token');
  const submission = useReportSubmission();
  const earlyContainer = {} as HTMLDivElement;
  submission.earlyTurnstileContainerRef.current = earlyContainer;
  runEarlyEffects();
  await vi.advanceTimersByTimeAsync(0);
  vi.setSystemTime(new Date('2026-01-01T00:04:01Z'));

  submission.submit(selection);
  await submission.start({} as HTMLDivElement, new AbortController().signal);

  expect(getToken).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ turnstileToken: 'fresh-token' }),
  );
  expect(track).toHaveBeenCalledWith(
    'report_turnstile_completed',
    expect.objectContaining({ earlyTokenUsed: false, tokenAgeMs: 241_000 }),
  );
});

it('ignores the first aborted StrictMode run and sends only once', async () => {
  let visibleCalls = 0;
  getToken.mockImplementation(
    (_action: unknown, options: { container?: HTMLElement; signal?: AbortSignal }) => {
      if (options.container?.dataset.turnstile === 'early-report')
        return Promise.resolve(undefined);
      visibleCalls += 1;
      if (visibleCalls === 1) {
        return new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () =>
            reject(new DOMException('Cancelled', 'AbortError')),
          );
        });
      }
      return Promise.resolve('visible-token');
    },
  );
  const submission = useReportSubmission();
  const earlyContainer = { dataset: { turnstile: 'early-report' } } as HTMLDivElement;
  const checksContainer = { dataset: { turnstile: 'report' } } as HTMLDivElement;
  submission.earlyTurnstileContainerRef.current = earlyContainer;
  runEarlyEffects();
  await vi.waitFor(() => expect(getToken).toHaveResolved());
  submission.submit(selection);
  const first = new AbortController();
  const staleRun = submission.start(checksContainer, first.signal);
  first.abort();
  const currentRun = submission.start(checksContainer, new AbortController().signal);
  await Promise.all([staleRun, currentRun]);

  expect(visibleCalls).toBe(2);
  expect(send).toHaveBeenCalledTimes(1);
  expect(vi.mocked(track).mock.calls.filter(([event]) => event === 'report_started')).toHaveLength(
    1,
  );
  expect(
    vi.mocked(track).mock.calls.filter(([event]) => event === 'report_turnstile_completed'),
  ).toHaveLength(1);
  expect(
    vi.mocked(track).mock.calls.filter(([event]) => event === 'report_location_completed'),
  ).toHaveLength(1);
});

it('does not send or log Turnstile failure after the checks screen closes', async () => {
  getToken.mockImplementation(
    (_action: unknown, options: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(new DOMException('Cancelled', 'AbortError')),
        );
      }),
  );
  const submission = useReportSubmission();
  submission.earlyTurnstileContainerRef.current = {} as HTMLDivElement;
  runEarlyEffects();
  submission.submit(selection);
  const controller = new AbortController();
  const pending = submission.start({} as HTMLDivElement, controller.signal);
  controller.abort();
  await pending;

  expect(send).not.toHaveBeenCalled();
  expect(captureIssue).not.toHaveBeenCalled();
  expect(vi.mocked(track).mock.calls.map(([event]) => event)).not.toContain(
    'report_turnstile_completed',
  );
});
