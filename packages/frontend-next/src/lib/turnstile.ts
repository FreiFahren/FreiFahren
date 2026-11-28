const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TOKEN_TIMEOUT_MS = 20_000;
export const SCRIPT_TIMEOUT_MS = 20_000;
export const INTERACTIVE_TOKEN_TIMEOUT_MS = 60_000;

export type TurnstileStage =
  | 'script_loading'
  | 'script_retry'
  | 'script_ready'
  | 'widget_render_started'
  | 'interaction_required'
  | 'hidden'
  | 'visible'
  | 'token_received'
  | 'error'
  | 'cancelled';

export type TurnstileAction = 'submit-report' | 'sign-in';
export const TURNSTILE_TOKEN_HEADER = 'cf-turnstile-response';

export type TurnstileFailureReason =
  | 'script_load_failed'
  | 'script_api_missing'
  | 'script_timeout'
  | 'token_timeout'
  | 'challenge_expired'
  | 'widget_error'
  | 'unknown';

export class TurnstileError extends Error {
  readonly reason: TurnstileFailureReason;
  readonly code?: string;

  constructor(message: string, reason: TurnstileFailureReason, code?: string) {
    super(message);
    this.name = 'TurnstileError';
    this.reason = reason;
    this.code = code;
  }
}

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      appearance?: 'always' | 'execute' | 'interaction-only';
      retry?: 'auto' | 'never';
      'refresh-timeout'?: 'auto' | 'manual' | 'never';
      callback: (token: string) => void;
      'error-callback': (code?: string) => void;
      'timeout-callback'?: () => void;
      'before-interactive-callback'?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

type WidgetPhase = 'loading' | 'automatic' | 'interactive' | 'settled';
type WidgetClock =
  | { kind: 'inactive' }
  | { kind: 'paused'; remainingMs: number }
  | { kind: 'running'; deadline: number; timer: ReturnType<typeof setTimeout> };
type ProviderEvent =
  | { type: 'interaction_required' }
  | { type: 'token_received'; token: string }
  | { type: 'error'; error: TurnstileError };

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const siteKey = (): string | undefined => {
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  return key === undefined || key === '' ? undefined : key;
};

/** True when a site key is configured, i.e. when submissions are expected to carry a token. */
export const isTurnstileConfigured = (): boolean => siteKey() !== undefined;

type ScriptLoad =
  | { kind: 'idle' }
  | {
      kind: 'loading';
      pending: Promise<TurnstileApi>;
      listeners: Set<(stage: TurnstileStage) => void>;
    };
let scriptLoad: ScriptLoad = { kind: 'idle' };

function emitStage(listener: ((stage: TurnstileStage) => void) | undefined, stage: TurnstileStage) {
  try {
    listener?.(stage);
  } catch {
    // Instrumentation must not change whether token acquisition succeeds.
  }
}

function loadScriptAttempt(timeoutMs: number): Promise<TurnstileApi> {
  return new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
    };
    const fail = (error: TurnstileError) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        script.remove();
      } catch {
        // Removing a failed script must not prevent the retry.
      }
      reject(error);
    };
    const timer = setTimeout(
      () => fail(new TurnstileError('Turnstile script timed out', 'script_timeout')),
      timeoutMs,
    );
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (settled) return;
      if (window.turnstile === undefined) {
        fail(new TurnstileError('Turnstile loaded without exposing its API', 'script_api_missing'));
        return;
      }
      settled = true;
      cleanup();
      resolve(window.turnstile);
    };
    script.onerror = () =>
      fail(new TurnstileError('Failed to load Turnstile', 'script_load_failed'));
    document.head.appendChild(script);
  });
}

async function loadWithRetry(onRetry: () => void): Promise<TurnstileApi> {
  const start = performance.now();
  try {
    return await loadScriptAttempt(SCRIPT_TIMEOUT_MS / 2);
  } catch (error) {
    const remaining = SCRIPT_TIMEOUT_MS - (performance.now() - start);
    if (remaining <= 0) throw error;
    onRetry();
    return loadScriptAttempt(remaining);
  }
}

function loadTurnstile(onStage?: (stage: TurnstileStage) => void): Promise<TurnstileApi> {
  if (window.turnstile !== undefined) {
    emitStage(onStage, 'script_ready');
    return Promise.resolve(window.turnstile);
  }

  if (scriptLoad.kind === 'idle') {
    const listeners = new Set<(stage: TurnstileStage) => void>();
    const notify = (stage: TurnstileStage) => {
      for (const listener of listeners) emitStage(listener, stage);
    };
    const pending = loadWithRetry(() => notify('script_retry'))
      .then((api) => {
        notify('script_ready');
        return api;
      })
      .finally(() => {
        scriptLoad = { kind: 'idle' };
      });
    scriptLoad = { kind: 'loading', pending, listeners };
  }
  const load = scriptLoad;
  if (onStage) load.listeners.add(onStage);
  emitStage(onStage, 'script_loading');
  return load.pending;
}

/** Loads the script ahead of a likely `getTurnstileToken`. */
export function preloadTurnstile(): void {
  if (siteKey() !== undefined) loadTurnstile().catch(() => {});
}

/** Mint one token. The caller chooses how to handle a failed or cancelled check. */
export async function getTurnstileToken(
  action: TurnstileAction,
  options: {
    timeoutMs?: number;
    container?: HTMLElement;
    signal?: AbortSignal;
    onStage?: (stage: TurnstileStage) => void;
  } = {},
): Promise<string | undefined> {
  const key = siteKey();
  if (key === undefined) return undefined;

  return new Promise<string>((resolve, reject) => {
    let phase: WidgetPhase = 'loading';
    let api: TurnstileApi | undefined;
    let widgetId: string | undefined;
    let container = options.container;
    let clock: WidgetClock = { kind: 'inactive' };
    let isHidden = document.visibilityState === 'hidden';
    const removeWidget = () => {
      const id = widgetId;
      widgetId = undefined;
      if (id === undefined) return;
      try {
        api?.remove(id);
      } catch {
        // Cleanup must not change the result of token acquisition.
      }
    };
    const cleanup = () => {
      if (clock.kind === 'running') clearTimeout(clock.timer);
      clock = { kind: 'inactive' };
      options.signal?.removeEventListener('abort', cancel);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      removeWidget();
      if (!options.container) {
        container?.remove();
        container = undefined;
      }
    };
    const settle = (complete: () => void) => {
      if (phase === 'settled') return false;
      phase = 'settled';
      cleanup();
      complete();
      return true;
    };
    const isSettled = () => phase === 'settled';
    const finishError = (error: unknown) => {
      if (settle(() => reject(error))) emitStage(options.onStage, 'error');
    };
    const cancel = () => {
      if (settle(() => reject(new DOMException('Turnstile cancelled', 'AbortError')))) {
        emitStage(options.onStage, 'cancelled');
      }
    };
    const startBudget = (remainingMs: number) => {
      if (clock.kind === 'running') clearTimeout(clock.timer);
      if (isHidden) {
        clock = { kind: 'paused', remainingMs };
        return;
      }
      const expire = () => finishError(new TurnstileError('Turnstile timed out', 'token_timeout'));
      clock = {
        kind: 'running',
        deadline: performance.now() + remainingMs,
        timer: setTimeout(expire, remainingMs),
      };
    };
    const onVisibilityChange = () => {
      const hidden = document.visibilityState === 'hidden';
      if (hidden === isHidden) return;
      isHidden = hidden;
      emitStage(options.onStage, hidden ? 'hidden' : 'visible');
      if (hidden && clock.kind === 'running') {
        startBudget(Math.max(0, clock.deadline - performance.now()));
      } else if (!hidden && clock.kind === 'paused') {
        if (clock.remainingMs === 0) {
          finishError(new TurnstileError('Turnstile timed out', 'token_timeout'));
        } else {
          startBudget(clock.remainingMs);
        }
      }
    };
    if (options.signal?.aborted) {
      cancel();
      return;
    }
    options.signal?.addEventListener('abort', cancel, { once: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (isHidden) emitStage(options.onStage, 'hidden');

    void loadTurnstile((stage) => {
      if (!isSettled()) emitStage(options.onStage, stage);
    })
      .then((turnstile) => {
        if (isSettled()) return;
        api = turnstile;
        if (!container) {
          container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.bottom = '1rem';
          container.style.left = '50%';
          container.style.transform = 'translateX(-50%)';
          container.style.zIndex = '9999';
          document.body.appendChild(container);
        }
        phase = 'automatic';
        startBudget(options.timeoutMs ?? TOKEN_TIMEOUT_MS);
        emitStage(options.onStage, 'widget_render_started');
        if (isSettled()) return;
        widgetId = turnstile.render(container, {
          sitekey: key,
          action,
          appearance: 'interaction-only',
          retry: 'never',
          'refresh-timeout': 'never',
          callback: (token) => handleProviderEvent({ type: 'token_received', token }),
          'before-interactive-callback': () =>
            handleProviderEvent({ type: 'interaction_required' }),
          'error-callback': (code) =>
            handleProviderEvent({
              type: 'error',
              error: new TurnstileError('Turnstile failed', 'widget_error', code),
            }),
          'timeout-callback': () =>
            handleProviderEvent({
              type: 'error',
              error: new TurnstileError('Turnstile challenge expired', 'challenge_expired'),
            }),
        });
        if (isSettled()) removeWidget();
      })
      .catch(finishError);

    function handleProviderEvent(event: ProviderEvent) {
      if (isSettled() || phase === 'loading') return;
      if (event.type === 'interaction_required') {
        if (phase === 'interactive') return;
        phase = 'interactive';
        emitStage(options.onStage, 'interaction_required');
        if (!isSettled()) startBudget(INTERACTIVE_TOKEN_TIMEOUT_MS);
        return;
      }
      if (event.type === 'token_received') {
        if (settle(() => resolve(event.token))) emitStage(options.onStage, 'token_received');
        return;
      }
      finishError(event.error);
    }
  });
}

export function isTurnstileChallengeFailure(error: unknown): boolean {
  return (
    error instanceof TurnstileError &&
    error.reason === 'widget_error' &&
    /^(?:300|600)\d{3}$/.test(error.code ?? '')
  );
}
