import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getTurnstileToken,
  INTERACTIVE_TOKEN_TIMEOUT_MS,
  isTurnstileChallengeFailure,
  SCRIPT_TIMEOUT_MS,
  TOKEN_TIMEOUT_MS,
  TurnstileError,
} from '../src/lib/turnstile';

let options: Parameters<NonNullable<Window['turnstile']>['render']>[1];
let duringRender: ((callbacks: typeof options) => void) | undefined;
const remove = vi.fn();
const removeContainer = vi.fn();
const visibilityListeners = new Set<() => void>();

function setVisibility(state: DocumentVisibilityState) {
  vi.stubGlobal('document', {
    visibilityState: state,
    addEventListener: (_name: string, listener: () => void) => visibilityListeners.add(listener),
    removeEventListener: (_name: string, listener: () => void) =>
      visibilityListeners.delete(listener),
    createElement: () => ({ style: {}, remove: removeContainer }),
    body: { appendChild: vi.fn() },
  });
}

function dispatchVisibility(state: DocumentVisibilityState) {
  setVisibility(state);
  for (const listener of visibilityListeners) listener();
}

function turnstileApi() {
  return {
    render: vi.fn((_container, callbacks) => {
      options = callbacks;
      duringRender?.(callbacks);
      return 'widget';
    }),
    remove,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', 'test-key');
  visibilityListeners.clear();
  options = undefined as unknown as typeof options;
  duringRender = undefined;
  vi.stubGlobal('window', { turnstile: turnstileApi() });
  setVisibility('visible');
});

afterEach(() => {
  vi.clearAllMocks();
  visibilityListeners.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('Turnstile token acquisition', () => {
  it('keeps the full widget budget after the script has loaded', async () => {
    const token = getTurnstileToken('submit-report');
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS - 1);
    expect(remove).not.toHaveBeenCalled();
    options.callback('token');
    expect(await token).toBe('token');
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows more time after Cloudflare requests interaction', async () => {
    const result = getTurnstileToken('submit-report').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS - 1);
    options['before-interactive-callback']?.();
    await vi.advanceTimersByTimeAsync(INTERACTIVE_TOKEN_TIMEOUT_MS - 1);
    expect(remove).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ reason: 'token_timeout' });
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
  });

  it('handles an interaction callback fired synchronously during render', async () => {
    duringRender = (callbacks) => callbacks['before-interactive-callback']?.();
    const controller = new AbortController();
    const stages: string[] = [];
    const result = getTurnstileToken('submit-report', {
      signal: controller.signal,
      onStage: (stage) => {
        stages.push(stage);
        if (stage === 'interaction_required') controller.abort();
      },
    }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(stages).toEqual(
      expect.arrayContaining(['widget_render_started', 'interaction_required', 'cancelled']),
    );
    expect(stages.indexOf('widget_render_started')).toBeLessThan(
      stages.indexOf('interaction_required'),
    );
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles terminal callbacks fired synchronously during render', async () => {
    duringRender = (callbacks) => callbacks['error-callback']('600010');
    const stages: string[] = [];
    const result = getTurnstileToken('submit-report', {
      onStage: (stage) => stages.push(stage),
    }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    expect(await result).toMatchObject({ reason: 'widget_error', code: '600010' });
    expect(stages.indexOf('widget_render_started')).toBeLessThan(stages.indexOf('error'));
    expect(stages).not.toContain('token_received');
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resolves a token callback fired synchronously during render', async () => {
    duringRender = (callbacks) => callbacks.callback('sync-token');
    const stages: string[] = [];
    const token = getTurnstileToken('submit-report', {
      onStage: (stage) => stages.push(stage),
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(await token).toBe('sync-token');
    expect(stages.indexOf('widget_render_started')).toBeLessThan(stages.indexOf('token_received'));
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses the challenge budget while the page is hidden', async () => {
    const result = getTurnstileToken('submit-report').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS / 2);
    dispatchVisibility('hidden');
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS * 3);
    expect(remove).not.toHaveBeenCalled();
    dispatchVisibility('visible');
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS / 2 - 1);
    options.callback('visible-token');
    expect(await result).toBe('visible-token');
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
  });

  it('keeps one interactive budget across hidden tabs and repeated interaction callbacks', async () => {
    setVisibility('hidden');
    const result = getTurnstileToken('submit-report').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS * 2);
    options['before-interactive-callback']?.();
    await vi.advanceTimersByTimeAsync(INTERACTIVE_TOKEN_TIMEOUT_MS * 2);
    expect(vi.getTimerCount()).toBe(0);
    dispatchVisibility('visible');
    await vi.advanceTimersByTimeAsync(INTERACTIVE_TOKEN_TIMEOUT_MS - 1);
    options['before-interactive-callback']?.();
    expect(remove).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toMatchObject({ reason: 'token_timeout' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns an error when the widget uses its full visible budget', async () => {
    const result = getTurnstileToken('submit-report').catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS);
    expect(await result).toMatchObject({ reason: 'token_timeout' });
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
    expect(removeContainer).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('preserves Cloudflare error codes and only classifies challenge failures', async () => {
    const stages: string[] = [];
    const result = getTurnstileToken('submit-report', {
      onStage: (stage) => stages.push(stage),
    }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    options['error-callback']('600010');
    options.callback('late-token');
    options['before-interactive-callback']?.();
    const error = await result;
    expect(error).toMatchObject({ reason: 'widget_error', code: '600010' });
    expect(isTurnstileChallengeFailure(error)).toBe(true);
    expect(
      isTurnstileChallengeFailure(new TurnstileError('script failed', 'script_load_failed')),
    ).toBe(false);
    expect(
      isTurnstileChallengeFailure(new TurnstileError('widget error', 'widget_error', '110200')),
    ).toBe(false);
    expect(stages.filter((stage) => stage === 'error')).toHaveLength(1);
    expect(stages).not.toContain('token_received');
    expect(stages).not.toContain('interaction_required');
    expect(window.turnstile?.render).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ retry: 'never', 'refresh-timeout': 'never' }),
    );
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('treats Cloudflare expiry as terminal and ignores later provider callbacks', async () => {
    const stages: string[] = [];
    const result = getTurnstileToken('submit-report', {
      onStage: (stage) => stages.push(stage),
    }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(0);
    options['timeout-callback']?.();
    options['error-callback']('600010');
    options.callback('late-token');
    expect(await result).toMatchObject({ reason: 'challenge_expired' });
    expect(stages.filter((stage) => stage === 'error')).toHaveLength(1);
    expect(stages).not.toContain('token_received');
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
  });

  it('reports cancellation and removes a React-owned widget only once', async () => {
    const host = document.createElement('div');
    const controller = new AbortController();
    const stages: string[] = [];
    const token = getTurnstileToken('submit-report', {
      container: host,
      signal: controller.signal,
      onStage: (stage) => stages.push(stage),
    });
    const rejected = expect(token).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await rejected;
    options.callback('late-token');
    options['before-interactive-callback']?.();
    expect(stages).toContain('cancelled');
    expect(stages).not.toContain('token_received');
    expect(stages).not.toContain('interaction_required');
    expect(remove).toHaveBeenCalledExactlyOnceWith('widget');
    expect(removeContainer).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries a failed shared script load once and ignores the stale callback', async () => {
    vi.resetModules();
    const scripts: Array<{
      onload: (() => void) | null;
      onerror: (() => void) | null;
      remove: () => void;
    }> = [];
    const api = turnstileApi();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (_name: string, listener: () => void) => visibilityListeners.add(listener),
      removeEventListener: (_name: string, listener: () => void) =>
        visibilityListeners.delete(listener),
      createElement: (tagName: string) => {
        if (tagName !== 'script') return { style: {}, remove: removeContainer };
        const script = { onload: null, onerror: null, remove: vi.fn() };
        scripts.push(script);
        return script;
      },
      head: { appendChild: vi.fn() },
      body: { appendChild: vi.fn() },
    });
    const { getTurnstileToken: getToken } = await import('../src/lib/turnstile');
    const stages: string[] = [];
    const token = getToken('submit-report', { onStage: (stage) => stages.push(stage) });
    const result = token.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    const staleOnload = scripts[0]?.onload;
    scripts[0]?.onerror?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(scripts).toHaveLength(2);
    staleOnload?.();
    Object.assign(window, { turnstile: api });
    scripts[1]?.onload?.();
    await vi.advanceTimersByTimeAsync(0);
    options.callback('retried-token');
    expect(await result).toEqual({ value: 'retried-token' });
    expect(stages).toEqual(
      expect.arrayContaining([
        'script_loading',
        'script_retry',
        'script_ready',
        'widget_render_started',
        'token_received',
      ]),
    );
    expect(scripts[0]?.remove).toHaveBeenCalledOnce();
    expect(api.remove).toHaveBeenCalledExactlyOnceWith('widget');
  });

  it('shares a single pending script request between token acquisitions', async () => {
    vi.resetModules();
    const scripts: Array<{
      onload: (() => void) | null;
      onerror: (() => void) | null;
      remove: () => void;
    }> = [];
    const api = turnstileApi();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (_name: string, listener: () => void) => visibilityListeners.add(listener),
      removeEventListener: (_name: string, listener: () => void) =>
        visibilityListeners.delete(listener),
      createElement: (tagName: string) => {
        if (tagName !== 'script') return { style: {}, remove: removeContainer };
        const script = { onload: null, onerror: null, remove: vi.fn() };
        scripts.push(script);
        return script;
      },
      head: { appendChild: vi.fn() },
      body: { appendChild: vi.fn() },
    });
    const { getTurnstileToken: getToken } = await import('../src/lib/turnstile');
    const firstToken = getToken('submit-report');
    const secondToken = getToken('sign-in');
    expect(scripts).toHaveLength(1);
    Object.assign(window, { turnstile: api });
    scripts[0]?.onload?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.render).toHaveBeenCalledTimes(2);
    const callbacks = api.render.mock.calls.map(([, callbackOptions]) => callbackOptions);
    callbacks[0]?.callback('report-token');
    callbacks[1]?.callback('sign-in-token');
    expect(await firstToken).toBe('report-token');
    expect(await secondToken).toBe('sign-in-token');
  });

  it('starts a full widget budget only after the script loads in a hidden page', async () => {
    vi.resetModules();
    let script!: { onload: (() => void) | null; onerror: (() => void) | null; remove: () => void };
    const api = turnstileApi();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {
      visibilityState: 'hidden',
      addEventListener: (_name: string, listener: () => void) => visibilityListeners.add(listener),
      removeEventListener: (_name: string, listener: () => void) =>
        visibilityListeners.delete(listener),
      createElement: (tagName: string) => {
        if (tagName !== 'script') return { style: {}, remove: removeContainer };
        return (script = { onload: null, onerror: null, remove: vi.fn() });
      },
      head: { appendChild: vi.fn() },
      body: { appendChild: vi.fn() },
    });
    const { getTurnstileToken: getToken } = await import('../src/lib/turnstile');
    const token = getToken('submit-report');
    await vi.advanceTimersByTimeAsync(SCRIPT_TIMEOUT_MS / 2);
    Object.assign(window, { turnstile: api });
    script.onload?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS * 2);
    setVisibility('visible');
    for (const listener of visibilityListeners) listener();
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS - 1);
    options.callback('hidden-load-token');
    expect(await token).toBe('hidden-load-token');
  });

  it('keeps script loading and widget waiting as separate budgets', async () => {
    vi.resetModules();
    let script!: { onload: (() => void) | null; onerror: (() => void) | null; remove: () => void };
    const api = turnstileApi();
    vi.stubGlobal('window', {});
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: (_name: string, listener: () => void) => visibilityListeners.add(listener),
      removeEventListener: (_name: string, listener: () => void) =>
        visibilityListeners.delete(listener),
      createElement: (tagName: string) => {
        if (tagName !== 'script') return { style: {}, remove: removeContainer };
        return (script = { onload: null, onerror: null, remove: vi.fn() });
      },
      head: { appendChild: vi.fn() },
      body: { appendChild: vi.fn() },
    });
    const { getTurnstileToken: getToken } = await import('../src/lib/turnstile');
    const token = getToken('submit-report');
    await vi.advanceTimersByTimeAsync(SCRIPT_TIMEOUT_MS / 2);
    Object.assign(window, { turnstile: api });
    script.onload?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(TOKEN_TIMEOUT_MS - 1);
    options.callback('separate-budgets-token');
    expect(await token).toBe('separate-budgets-token');
  });
});
