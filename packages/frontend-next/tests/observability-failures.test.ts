import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../src/lib/posthog-client', () => ({ enqueuePostHog: vi.fn() }));
vi.mock('@sentry/react', () => ({ captureMessage: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'web' } }));
vi.mock('../src/lib/city', () => ({ currentCitySlug: 'test' }));

import { captureMessage } from '@sentry/react';
import { enqueuePostHog } from '../src/lib/posthog-client';
import { track } from '../src/lib/analytics';
import { captureIssue } from '../src/lib/error-monitoring';

afterEach(() => {
  vi.resetAllMocks();
});

it.each(['immediate', 'queued'])(
  'does not propagate %s analytics SDK failures into reporting',
  (mode) => {
    type Operation = Parameters<typeof enqueuePostHog>[0];
    const capture = vi.fn(() => {
      throw new Error('SDK unavailable');
    });
    const posthog = { capture } as unknown as Parameters<Operation>[0];
    let queued: Operation | undefined;
    vi.mocked(enqueuePostHog).mockImplementation((operation) => {
      if (mode === 'immediate') operation(posthog);
      else queued = operation;
    });
    expect(() =>
      track('report_started', { attemptId: 'attempt', stationId: 'station', checkId: 'check' }),
    ).not.toThrow();
    expect(() => queued?.(posthog)).not.toThrow();
    expect(capture).toHaveBeenCalledTimes(1);
  },
);

it('keeps handled-issue reporting non-fatal when Sentry fails', () => {
  vi.mocked(captureMessage).mockImplementation(() => {
    throw new Error('SDK unavailable');
  });
  expect(() =>
    captureIssue(
      'Turnstile token could not be obtained',
      { attemptId: 'attempt' },
      {
        reason: 'token_timeout',
        stage: 'challenge',
      },
    ),
  ).not.toThrow();
  expect(captureMessage).toHaveBeenCalledWith('Turnstile token could not be obtained', {
    level: 'warning',
    tags: { platform: 'web', reason: 'token_timeout', stage: 'challenge' },
    extra: { attemptId: 'attempt' },
  });
});
