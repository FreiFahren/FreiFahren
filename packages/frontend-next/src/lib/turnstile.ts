const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TOKEN_TIMEOUT_MS = 20_000;

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
      callback: (token: string) => void;
      'error-callback': (code?: string) => void;
      'timeout-callback'?: () => void;
      'before-interactive-callback'?: () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

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

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile !== undefined) return Promise.resolve(window.turnstile);
  if (scriptPromise !== null) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile === undefined) {
        reject(
          new TurnstileError('Turnstile loaded without exposing its API', 'script_api_missing'),
        );
        return;
      }
      resolve(window.turnstile);
    };
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      scriptPromise = null;
      reject(new TurnstileError('Failed to load Turnstile', 'script_load_failed'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
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
    onInteractionRequired?: () => void;
  } = {},
): Promise<string | undefined> {
  const key = siteKey();
  if (key === undefined) return undefined;

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let api: TurnstileApi | undefined;
    let widgetId: string | undefined;
    let container = options.container;
    let timeoutReason: TurnstileFailureReason = 'script_timeout';
    const cleanup = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      if (widgetId !== undefined) {
        api?.remove(widgetId);
        widgetId = undefined;
      }
      if (!options.container) {
        container?.remove();
        container = undefined;
      }
    };
    const settle = (complete: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      complete();
    };
    const cancel = () =>
      settle(() => reject(new DOMException('Turnstile cancelled', 'AbortError')));
    const timer = setTimeout(
      () => settle(() => reject(new TurnstileError('Turnstile timed out', timeoutReason))),
      options.timeoutMs ?? TOKEN_TIMEOUT_MS,
    );
    if (options.signal?.aborted) {
      cancel();
      return;
    }
    options.signal?.addEventListener('abort', cancel, { once: true });

    void loadTurnstile()
      .then((turnstile) => {
        if (settled) return;
        api = turnstile;
        timeoutReason = 'token_timeout';
        if (!container) {
          container = document.createElement('div');
          container.style.position = 'fixed';
          container.style.bottom = '1rem';
          container.style.left = '50%';
          container.style.transform = 'translateX(-50%)';
          container.style.zIndex = '9999';
          document.body.appendChild(container);
        }
        widgetId = turnstile.render(container, {
          sitekey: key,
          action,
          appearance: 'interaction-only',
          callback: (token) => settle(() => resolve(token)),
          'before-interactive-callback': options.onInteractionRequired,
          'error-callback': (code) =>
            settle(() => reject(new TurnstileError('Turnstile failed', 'widget_error', code))),
          'timeout-callback': () =>
            settle(() =>
              reject(new TurnstileError('Turnstile challenge expired', 'challenge_expired')),
            ),
        });
        if (settled) cleanup();
      })
      .catch((error: unknown) => settle(() => reject(error)));
  });
}
