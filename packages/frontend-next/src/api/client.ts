import { currentCitySlug } from '@/lib/city';
import { requireEnv } from '@/lib/utils';

function resolveApiUrl(configured: string): string {
  if (!import.meta.env.DEV || typeof window === 'undefined') return configured;
  try {
    const url = new URL(configured);
    url.hostname = window.location.hostname;
    return url.origin;
  } catch {
    return configured;
  }
}

export const API_URL = resolveApiUrl(requireEnv('VITE_API_URL'));

export class HttpError extends Error {
  readonly status: number;

  constructor(path: string, status: number) {
    super(`Request to ${path} failed: ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Every API call carries the resolved city so the worker scopes it to the right DB/cache.
  const url = new URL(`${API_URL}${path}`);
  url.searchParams.set('city', currentCitySlug);
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new HttpError(path, response.status);
  }
  return response.json();
}
