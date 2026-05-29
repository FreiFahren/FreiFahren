import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function optionalEnv(key: string): string | undefined {
  const raw = import.meta.env[key];
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

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
