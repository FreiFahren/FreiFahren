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

// Signed-in devices keep their account controls when the flag is off or PostHog doesn't load.
export function useAccountsEnabled(): boolean {
  const flagged = useFeatureFlag(FEATURE_FLAGS.accounts);
  return AUTH_URL !== undefined && (flagged || safeLocalStorage.getItem(STORAGE_KEY) !== null);
}

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
