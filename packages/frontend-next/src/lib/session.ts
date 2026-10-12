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

export function useAccountsEnabled(): boolean {
  return useFeatureFlag(FEATURE_FLAGS.accounts) && AUTH_URL !== undefined;
}

/*
 * Bearer token rather than a cookie: cookies on freifahren.org never reach the native WebView
 * (capacitor://localhost) or workers.dev previews. Mirrored to native Preferences to survive a
 * WebView storage purge.
 */
const STORAGE_KEY = 'freifahren-session-token';

// Purges only happen while the app isn't running, so one restore per start is enough.
let restored: Promise<boolean> | undefined;

export async function getSessionToken(): Promise<string | undefined> {
  restored ??= restoreNativePreference(STORAGE_KEY);
  await restored;
  return safeLocalStorage.getItem(STORAGE_KEY) ?? undefined;
}

export function setSessionToken(token: string): Promise<void> {
  return saveNativePreference(STORAGE_KEY, token);
}

export function clearSessionToken(): Promise<void> {
  return removeNativePreference(STORAGE_KEY);
}
