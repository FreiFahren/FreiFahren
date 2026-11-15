import { getSessionToken } from '@/lib/session';
import { optionalEnv } from '@/lib/utils';

export type {
  Fine,
  FineConfirmation,
  FineDetails,
  FineUploadVersion,
} from '@freifahren/contracts/fund';

export class FundRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super('Fund request failed');
    this.status = status;
  }
}

export async function fetchFund(
  path: string,
  options: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const baseUrl = optionalEnv('VITE_FUND_URL');
  const token = await getSessionToken();
  if (!baseUrl) throw new FundRequestError(503);
  if (!token) throw new FundRequestError(401);

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  // AbortSignal.timeout/any are newer than our browser floor. Keep this controller-based path:
  // the build target transforms syntax, but cannot supply missing browser APIs.
  const controller = new AbortController();
  const cleanup = () => {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  };
  const abort = () => {
    controller.abort(options.signal?.reason);
    cleanup();
  };
  const timeout = window.setTimeout(() => {
    controller.abort(new DOMException('The request timed out.', 'TimeoutError'));
    cleanup();
  }, timeoutMs);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...options,
      headers,
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new FundRequestError(response.status);
    // Fetch resolves at headers; keep cancellation active while the caller reads the body.
    return response;
  } catch (error) {
    cleanup();
    throw error;
  }
}
