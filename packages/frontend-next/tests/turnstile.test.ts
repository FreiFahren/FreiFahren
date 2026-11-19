import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTurnstileToken } from '../src/lib/turnstile';

let options: Parameters<NonNullable<Window['turnstile']>['render']>[1];
const remove = vi.fn();
const removeContainer = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-key');
  vi.stubGlobal('window', {
    turnstile: {
      render: vi.fn((_container, callbacks) => {
        options = callbacks;
        return 'widget';
      }),
      remove,
    },
  });
  vi.stubGlobal('document', {
    createElement: () => ({ style: {}, remove: removeContainer }),
    body: { appendChild: vi.fn() },
  });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Report token budget and failure details', () => {
  it('allows a challenge to finish after the former eight-second cutoff', async () => {
    const token = getTurnstileToken('submit-report');
    await vi.advanceTimersByTimeAsync(12_000);
    expect(remove).not.toHaveBeenCalled();
    options.callback('token');
    expect(await token).toBe('token');
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports a token timeout after twenty seconds and removes the widget', async () => {
    const result = getTurnstileToken('submit-report').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await result).toMatchObject({ reason: 'token_timeout' });
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
    expect(removeContainer).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves the Cloudflare error code without parsing its message', async () => {
    const result = getTurnstileToken('submit-report').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    options['error-callback']('110200');
    expect(await result).toMatchObject({ reason: 'widget_error', code: '110200' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('distinguishes a stalled script from a challenge timeout', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {
      createElement: () => ({}),
      head: { appendChild: vi.fn() },
    });
    const result = getTurnstileToken('submit-report').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await result).toMatchObject({ reason: 'script_timeout' });
    expect(remove).not.toHaveBeenCalled();
  });
});
