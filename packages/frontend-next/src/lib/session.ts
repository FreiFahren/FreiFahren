import { FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import {
  removeNativePreference,
  restoreNativePreference,
  saveNativePreference,
} from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';
import { optionalEnv } from '@/lib/utils';

// Unset where no auth-worker is reachable; sign-in is then hidden rather than broken.
export const AUTH_URL = optionalEnv('VITE_AUTH_URL');

// Accounts are still rolling out behind a flag, which hides the entry button and the account page.
export function useAccountsEnabled(): boolean {
  return useFeatureFlag(FEATURE_FLAGS.accounts) && AUTH_URL !== undefined;
}

/*
 * Every client authenticates with a bearer token rather than a cookie: cookies on freifahren.org
 * never reach the native WebView (capacitor://localhost) or workers.dev previews. The token is
 * mirrored to native Preferences, like the other values that must survive a WebView storage purge.
 */
const STORAGE_KEY = 'freifahren-session-token';

// A purge only happens while the app isn't running, so one restore per start is enough; later
// reads, including every signed-out one, stay on localStorage.
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
