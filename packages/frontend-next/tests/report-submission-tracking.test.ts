import { afterEach, expect, it, vi } from 'vitest';

vi.mock('react', () => ({
  useRef: (current: unknown) => ({ current }),
  useState: () => [null, vi.fn()],
}));
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
  getTurnstileToken: vi.fn(),
}));

import { useReportSubmission } from '../src/components/report/use-report-submission';
import { track } from '../src/lib/analytics';
import { captureIssue } from '../src/lib/error-monitoring';
import { getTurnstileToken, TurnstileError } from '../src/lib/turnstile';

const send = vi.fn(
  async (input: { stationId: string; attemptId?: string; turnstileToken?: string }) => ({
    stationId: input.stationId,
    lineId: null,
    directionId: null,
  }),
);

afterEach(() => vi.clearAllMocks());

it('correlates a token timeout with one fallback submission and its acknowledgement', async () => {
  vi.mocked(getTurnstileToken).mockRejectedValue(new TurnstileError('timeout', 'token_timeout'));
  // The hook dependencies are mocked to drive the normal submit entry point without a renderer.
  const submission = useReportSubmission();
  await submission.submit({ stationId: 'station', lineName: null, directionStationId: null });
  expect(getTurnstileToken).toHaveBeenCalledExactlyOnceWith('submit-report');
  const attemptId = send.mock.calls[0]?.[0]?.attemptId;
  expect(attemptId).toEqual(expect.any(String));
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({ turnstileToken: undefined, attemptId }),
  );
  expect(track).toHaveBeenCalledWith('report_started', { stationId: 'station', attemptId });
  expect(track).toHaveBeenCalledWith(
    'report_turnstile_completed',
    expect.objectContaining({
      attemptId,
      outcome: 'failed',
      reason: 'token_timeout',
      timeoutMs: 20_000,
    }),
  );
  expect(captureIssue).toHaveBeenCalledWith(
    'Turnstile token could not be obtained',
    expect.objectContaining({
      attemptId,
      reason: 'token_timeout',
    }),
  );
  expect(track).toHaveBeenCalledWith('report_submitted', expect.objectContaining({ attemptId }));
  expect(vi.mocked(track).mock.calls.map(([event]) => event)).not.toContain('report_rejected');
});
