import { afterEach, expect, it, vi } from 'vitest';

const { getToken, effects, refs, cursor } = vi.hoisted(() => ({
  getToken: vi.fn(),
  effects: [] as (() => void | (() => void))[],
  refs: [] as { current: unknown }[],
  cursor: { ref: 0, cleanup: undefined as (() => void) | undefined },
}));

vi.mock('react', () => ({
  useRef: (current: unknown) => {
    const index = cursor.ref++;
    refs[index] ??= { current };
    return refs[index];
  },
  useState: (value: unknown) => [value, vi.fn()],
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
import { TurnstileError, type TurnstileStage } from '../src/lib/turnstile';

const send = vi.fn(
  async (input: { stationId: string; attemptId?: string; turnstileToken?: string }) => ({
    stationId: input.stationId,
    lineId: null,
    directionId: null,
  }),
);
const selection = { stationId: 'station', lineName: null, directionStationId: null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function runEffects() {
  cursor.cleanup?.();
  cursor.cleanup = undefined;
  const effect = effects.shift();
  const cleanup = effect?.();
  if (cleanup) cursor.cleanup = cleanup;
}

function renderHook<T>(hook: () => T): T {
  cursor.ref = 0;
  return hook();
}

function flushMicrotasks() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function getEvents(eventName: string) {
  return vi
    .mocked(track)
    .mock.calls.filter(([event]) => event === eventName)
    .map(([, properties]) => properties);
}

afterEach(() => {
  cursor.cleanup?.();
  cursor.cleanup = undefined;
  effects.splice(0);
  refs.length = 0;
  cursor.ref = 0;
  getToken.mockReset();
  send.mockClear();
  vi.clearAllMocks();
  vi.useRealTimers();
});

it('keeps one pending challenge on the same host while submit joins it', async () => {
  const pendingToken = deferred<string>();
  getToken.mockReturnValue(pendingToken.promise);
  const submission = renderHook(useReportSubmission);
  const container = {} as HTMLDivElement;
  submission.turnstileContainerRef.current = container;
  runEffects();
  await Promise.resolve();

  expect(getToken).toHaveBeenCalledExactlyOnceWith(
    'submit-report',
    expect.objectContaining({ container }),
  );
  const onStage = getToken.mock.calls[0]?.[1]?.onStage as (stage: TurnstileStage) => void;
  onStage('script_ready');
  onStage('widget_render_started');

  submission.submit(selection);
  const pendingSubmission = submission.start(new AbortController().signal);
  expect(getToken).toHaveBeenCalledTimes(1);

  pendingToken.resolve('joined-token');
  await pendingSubmission;

  const attemptId = getEvents('report_started')[0]?.attemptId;
  const checkId = getEvents('report_started')[0]?.checkId;
  expect(attemptId).toEqual(expect.any(String));
  expect(checkId).toEqual(expect.any(String));
  expect(getToken.mock.calls[0]?.[1]).toMatchObject({ container });
  expect(send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ turnstileToken: 'joined-token', attemptId }),
  );
  expect(getEvents('report_turnstile_stage')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ checkId, flow: 'prefetch', stage: 'script_ready' }),
      expect.objectContaining({ checkId, flow: 'prefetch', stage: 'widget_render_started' }),
    ]),
  );
  expect(getEvents('report_turnstile_completed')).toEqual([
    expect.objectContaining({
      attemptId,
      checkId,
      outcome: 'passed',
      acquisition: 'joined',
      retryCount: 0,
      earlyTokenUsed: false,
      widgetDurationMs: expect.any(Number),
    }),
  ]);
});

it('defers an early interactive challenge and starts a visible check after submit', async () => {
  const submission = renderHook(useReportSubmission);
  const container = {} as HTMLDivElement;
  submission.turnstileContainerRef.current = container;
  getToken.mockImplementation(
    (
      _action: string,
      options: {
        container?: HTMLElement;
        signal?: AbortSignal;
        onStage?: (stage: TurnstileStage) => void;
      },
    ) => {
      if (getToken.mock.calls.length > 1) {
        options.onStage?.('widget_render_started');
        options.onStage?.('token_received');
        return Promise.resolve('visible-token');
      }
      return new Promise<string>((_resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true },
        );
        queueMicrotask(() => options.onStage?.('widget_render_started'));
        // Cloudflare's before-interactive callback arrives after the widget renders.
        queueMicrotask(() => options.onStage?.('interaction_required'));
      });
    },
  );
  runEffects();
  await flushMicrotasks();

  expect(getToken).toHaveBeenCalledTimes(1);
  expect(getEvents('report_turnstile_completed')).toHaveLength(0);
  expect(getEvents('report_turnstile_stage')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ flow: 'prefetch', stage: 'interaction_deferred' }),
      expect.objectContaining({ flow: 'prefetch', stage: 'cancelled' }),
    ]),
  );

  submission.submit(selection);
  await submission.start(new AbortController().signal);

  const attemptId = getEvents('report_started')[0]?.attemptId;
  expect(getToken).toHaveBeenCalledTimes(2);
  expect(getToken.mock.calls.map(([, options]) => options?.container)).toEqual([
    container,
    container,
  ]);
  expect(send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ turnstileToken: 'visible-token', attemptId }),
  );
  expect(getEvents('report_turnstile_completed')).toEqual([
    expect.objectContaining({
      attemptId,
      outcome: 'passed',
      acquisition: 'deferred',
      retryCount: 0,
      interactionRequired: false,
    }),
  ]);
  expect(getEvents('report_turnstile_stage')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ flow: 'submit', attemptId, stage: 'widget_render_started' }),
      expect.objectContaining({ flow: 'submit', attemptId, stage: 'token_received' }),
    ]),
  );
});

it('reuses a fresh token from the persistent widget without requesting a second one', async () => {
  getToken.mockResolvedValueOnce('fresh-token');
  const submission = renderHook(useReportSubmission);
  submission.turnstileContainerRef.current = {} as HTMLDivElement;
  runEffects();
  await flushMicrotasks();

  submission.submit(selection);
  await submission.start(new AbortController().signal);

  expect(getToken).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ turnstileToken: 'fresh-token' }),
  );
  expect(getEvents('report_turnstile_completed')).toEqual([
    expect.objectContaining({
      outcome: 'passed',
      acquisition: 'cached',
      earlyTokenUsed: true,
      tokenAgeMs: expect.any(Number),
      retryCount: 0,
    }),
  ]);
});

it('retries a settled technical prefetch failure once when the reporter submits', async () => {
  getToken
    .mockRejectedValueOnce(new TurnstileError('script failed', 'script_load_failed'))
    .mockResolvedValueOnce('retry-token');
  const submission = renderHook(useReportSubmission);
  const container = {} as HTMLDivElement;
  submission.turnstileContainerRef.current = container;
  runEffects();
  await flushMicrotasks();

  submission.submit(selection);
  await submission.start(new AbortController().signal);

  const attemptId = getEvents('report_started')[0]?.attemptId;
  const checkId = getEvents('report_started')[0]?.checkId;
  expect(getToken).toHaveBeenCalledTimes(2);
  expect(getToken.mock.calls.map(([, options]) => options?.container)).toEqual([
    container,
    container,
  ]);
  expect(send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ turnstileToken: 'retry-token', attemptId }),
  );
  expect(getEvents('report_turnstile_completed')).toEqual([
    expect.objectContaining({
      attemptId,
      checkId,
      outcome: 'passed',
      acquisition: 'retry',
      retryCount: 1,
      earlyTokenUsed: false,
      scriptRetries: 0,
    }),
  ]);
  expect(captureIssue).not.toHaveBeenCalled();
});

it('keeps a joined technical failure unavailable and sends without a token', async () => {
  const pendingToken = deferred<string>();
  getToken.mockReturnValue(pendingToken.promise);
  const submission = renderHook(useReportSubmission);
  submission.turnstileContainerRef.current = {} as HTMLDivElement;
  runEffects();

  submission.submit(selection);
  const pendingSubmission = submission.start(new AbortController().signal);
  await Promise.resolve();
  expect(getToken).toHaveBeenCalledTimes(1);
  pendingToken.reject(new TurnstileError('challenge timed out', 'token_timeout'));
  await pendingSubmission;

  const attemptId = getEvents('report_started')[0]?.attemptId;
  expect(getToken).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ turnstileToken: undefined, attemptId }),
  );
  expect(getEvents('report_turnstile_completed')).toEqual([
    expect.objectContaining({
      attemptId,
      outcome: 'unavailable',
      reason: 'token_timeout',
      acquisition: 'joined',
      retryCount: 0,
    }),
  ]);
  expect(captureIssue).toHaveBeenCalledExactlyOnceWith(
    'Turnstile token could not be obtained',
    expect.objectContaining({ attemptId, reason: 'token_timeout' }),
    expect.objectContaining({
      attemptId,
      turnstileOutcome: 'unavailable',
      turnstileReason: 'token_timeout',
    }),
  );
});

it('classifies only an explicit Cloudflare challenge rejection as failed', async () => {
  getToken.mockRejectedValueOnce(new TurnstileError('challenge failed', 'widget_error', '600010'));
  const submission = renderHook(useReportSubmission);
  submission.turnstileContainerRef.current = {} as HTMLDivElement;
  runEffects();
  await flushMicrotasks();

  submission.submit(selection);
  await submission.start(new AbortController().signal);

  expect(getToken).toHaveBeenCalledTimes(1);
  expect(getEvents('report_turnstile_completed')).toEqual([
    expect.objectContaining({
      outcome: 'failed',
      reason: 'widget_error',
      errorCode: '600010',
      acquisition: 'cached',
      retryCount: 0,
    }),
  ]);
  expect(send).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ turnstileToken: undefined }),
  );
});

it('retries with a new session after reset and links the new check id', async () => {
  getToken.mockResolvedValueOnce('first-token').mockResolvedValueOnce('second-token');
  let submission = renderHook(useReportSubmission);
  const container = {} as HTMLDivElement;
  submission.turnstileContainerRef.current = container;
  runEffects();
  await flushMicrotasks();

  submission.submit(selection);
  await submission.start(new AbortController().signal);
  const firstCheckId = getEvents('report_started')[0]?.checkId;

  submission.reset();
  // Simulate React's rerender after reset changes the session generation.
  submission = renderHook(useReportSubmission);
  runEffects();
  await flushMicrotasks();
  submission.submit(selection);
  await submission.start(new AbortController().signal);

  const startedEvents = getEvents('report_started');
  const completedEvents = getEvents('report_turnstile_completed');
  expect(getToken).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenCalledTimes(2);
  expect(startedEvents).toHaveLength(2);
  expect(completedEvents).toHaveLength(2);
  expect(startedEvents[1]?.checkId).not.toBe(firstCheckId);
  expect(completedEvents.map((event) => event.checkId)).toEqual(
    startedEvents.map((event) => event.checkId),
  );
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls.map(([input]) => input.turnstileToken)).toEqual([
    'first-token',
    'second-token',
  ]);
});

it('does not send after the verification screen closes during a pending check', async () => {
  const pendingToken = deferred<string>();
  getToken.mockReturnValue(pendingToken.promise);
  const submission = renderHook(useReportSubmission);
  submission.turnstileContainerRef.current = {} as HTMLDivElement;
  runEffects();
  submission.submit(selection);
  const controller = new AbortController();
  const pendingSubmission = submission.start(controller.signal);
  controller.abort();
  pendingToken.resolve('late-token');
  await pendingSubmission;

  expect(send).not.toHaveBeenCalled();
  expect(captureIssue).not.toHaveBeenCalled();
  expect(getEvents('report_turnstile_completed')).toHaveLength(0);
});
