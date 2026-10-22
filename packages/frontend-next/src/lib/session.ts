import { useSyncExternalStore } from 'react';

import { FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import {
  removeNativePreference,
  restoreNativePreference,
  saveNativePreference,
} from '@/lib/native-preference';
import { setPostHogFlagAccount } from '@/lib/posthog-client';
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
// Kept beside the token so feature flags can target the account without a session lookup on boot.
const ACCOUNT_ID_KEY = 'freifahren-account-id';
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Signed-in devices keep their account controls when the flag is off or PostHog doesn't load.
export function useAccountsEnabled(): boolean {
  const flagged = useFeatureFlag(FEATURE_FLAGS.accounts);
  const token = useSyncExternalStore(subscribe, () => safeLocalStorage.getItem(STORAGE_KEY));
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
  safeLocalStorage.removeItem(ACCOUNT_ID_KEY);
  setPostHogFlagAccount(null);
  const removed = removeNativePreference(STORAGE_KEY);
  notify();
  return removed;
}

export function getSessionAccountId(): string | null {
  return safeLocalStorage.getItem(ACCOUNT_ID_KEY);
}

export function setSessionAccountId(accountId: string): void {
  safeLocalStorage.setItem(ACCOUNT_ID_KEY, accountId);
  setPostHogFlagAccount(accountId);
}

// Confirms a stored session once per start: auth-client stores the account id from the response, or
// clears an expired or revoked token. Signed-out devices skip it. The token is restored first, so
// after a WebView purge the response stores the account id again.
export async function refreshSessionAccount(): Promise<void> {
  if (!AUTH_URL || (await getSessionToken()) === undefined) return;
  const { authClient } = await import('@/lib/auth-client');
  // Through the shared session atom, so a useSession() mount right after reuses this request.
  await authClient.$store.atoms.session.get().refetch();
}
