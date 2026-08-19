import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function optionalEnv(key: string): string | undefined {
  const raw = import.meta.env[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

// A PR preview serves every city from one workers.dev host, so anything keyed off the subdomain
// (city resolution) or off PostHog (feature flags) needs a different source there.
export const isPreviewBuild = optionalEnv('VITE_PREVIEW') !== undefined;

function isIosInAppBrowser(ua: string): boolean {
  if (!/iPhone|iPod|iPad/i.test(ua)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)) return false;
  return !/Safari\//i.test(ua);
}

export const isTelegramInAppBrowser =
  typeof navigator !== 'undefined' &&
  (/Telegram/i.test(navigator.userAgent) ||
    isIosInAppBrowser(navigator.userAgent) ||
    (typeof window !== 'undefined' &&
      ('TelegramWebviewProxy' in window || 'Telegram' in window)));

export function requireEnv(key: string): string;
export function requireEnv(key: string, as: 'number'): number;
export function requireEnv(key: string, as?: 'number'): string | number {
  const raw = import.meta.env[key];
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(`Missing or invalid env var: ${key}`);
  }
  if (as === 'number') {
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      throw new Error(`Missing or invalid env var: ${key}`);
    }
    return num;
  }
  return raw;
}
