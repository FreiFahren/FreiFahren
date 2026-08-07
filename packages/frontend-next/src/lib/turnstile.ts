/*
 * Cloudflare Turnstile, loaded only when a report is actually being submitted.
 *
 * The widget renders in managed mode, which is invisible for almost every client and only escalates
 * to something the user has to touch when the request looks suspicious. Reporting an inspector is
 * time-critical, so the cost has to stay at one round trip rather than a puzzle.
 *
 * Every call mints a fresh token: Cloudflare rejects a replayed one, so a token cannot be cached
 * and reused across submissions. That single-use property is the whole point — it prices the
 * attack per report instead of per IP address, which is the axis address rotation cannot beat.
 */

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TOKEN_TIMEOUT_MS = 20_000;

// Bound here and checked by the API, so a token minted elsewhere cannot be redeemed for a report.
export const TURNSTILE_ACTION = 'submit-report';
export const TURNSTILE_TOKEN_HEADER = 'cf-turnstile-response';

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
        reject(new Error('Turnstile loaded without exposing its API'));
        return;
      }
      resolve(window.turnstile);
    };
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever.
      scriptPromise = null;
      reject(new Error('Failed to load Turnstile'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/**
 * Mint a single-use Turnstile token, or `undefined` when no site key is configured (local dev and
 * PR previews, where the API has no secret either and skips verification).
 *
 * Rejects if the challenge fails or takes too long, so the caller can surface a normal submission
 * error instead of posting a report the API will refuse.
 */
export async function getTurnstileToken(): Promise<string | undefined> {
  const key = siteKey();
  if (key === undefined) return undefined;

  const turnstile = await loadTurnstile();

  // Off-screen rather than display:none — Turnstile refuses to run in a hidden container, and an
  // interactive challenge still needs somewhere real to paint if managed mode escalates.
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '1rem';
  container.style.left = '50%';
  container.style.transform = 'translateX(-50%)';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  let widgetId: string | undefined;
  const cleanup = () => {
    if (widgetId !== undefined) turnstile.remove(widgetId);
    container.remove();
  };

  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Turnstile timed out')), TOKEN_TIMEOUT_MS);
      const settle = (fn: () => void) => {
        clearTimeout(timer);
        fn();
      };
      widgetId = turnstile.render(container, {
        sitekey: key,
        action: TURNSTILE_ACTION,
        // Stay invisible unless the challenge actually needs the user.
        appearance: 'interaction-only',
        callback: (token) => settle(() => resolve(token)),
        'error-callback': (code) =>
          settle(() =>
            reject(new Error(`Turnstile failed${code === undefined ? '' : `: ${code}`}`)),
          ),
        'timeout-callback': () => settle(() => reject(new Error('Turnstile challenge expired'))),
      });
    });
  } finally {
    cleanup();
  }
}
