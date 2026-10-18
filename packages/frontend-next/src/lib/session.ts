import { useSyncExternalStore } from 'react';

import { FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import {
  removeNativePreference,
  restoreNativePreference,
  saveNativePreference,
} from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';
import { optionalEnv } from '@/lib/utils';

// Unset hides sign-in.
export const AUTH_URL = optionalEnv('VITE_AUTH_URL');

/*
 * Bearer token rather than a cookie: cookies on freifahren.org never reach the native WebView
 * (capacitor://localhost) or workers.dev previews. Mirrored to native Preferences to survive a
 * WebView storage purge.
 */
const STORAGE_KEY = 'freifahren-session-token';
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSessionToken(): string | null {
  return useSyncExternalStore(subscribe, () => safeLocalStorage.getItem(STORAGE_KEY));
}

// Signed-in devices keep their account controls when the flag is off or PostHog doesn't load.
export function useAccountsEnabled(): boolean {
  const flagged = useFeatureFlag(FEATURE_FLAGS.accounts);
  const token = useSessionToken();
  return AUTH_URL !== undefined && (flagged || token !== null);
}

// Purges only happen while the app isn't running, so one restore per start is enough.
let restored: Promise<boolean> | undefined;

export async function getSessionToken(): Promise<string | undefined> {
  restored ??= restoreNativePreference(STORAGE_KEY).then((changed) => {
    if (changed) notify();
    return changed;
  });
  await restored;
  return safeLocalStorage.getItem(STORAGE_KEY) ?? undefined;
}

export function setSessionToken(token: string): Promise<void> {
  const saved = saveNativePreference(STORAGE_KEY, token);
  notify();
  return saved;
}

export function clearSessionToken(): Promise<void> {
  const removed = removeNativePreference(STORAGE_KEY);
  notify();
  return removed;
}
