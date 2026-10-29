import { getSessionToken } from '@/lib/session';
import { optionalEnv } from '@/lib/utils';

export type Fine = {
  id: string;
  status: 'in_review' | 'paid' | 'declined';
  createdAt: string;
  paidAt: string | null;
  declineReason: string | null;
};

export type FineUploadVersion = Fine & { version: number; current: boolean };

export type FineDetails = Fine & { uploads: FineUploadVersion[] };

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
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (options.signal) signals.push(options.signal);

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    ...options,
    headers,
    credentials: 'omit',
    cache: 'no-store',
    signal: AbortSignal.any(signals),
  });
  if (!response.ok) throw new FundRequestError(response.status);
  return response;
}
