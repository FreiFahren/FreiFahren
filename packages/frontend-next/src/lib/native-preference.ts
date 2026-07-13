import { Capacitor } from '@capacitor/core';

import { safeLocalStorage } from '@/lib/safe-storage';

// A value kept in localStorage (read synchronously at boot) and, on native, mirrored to Capacitor
// Preferences so it survives WebView storage purges that localStorage does not.

async function mirror(key: string, value: string): Promise<void> {
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
  } catch {
    /* best-effort mirror */
  }
}

// Returns the mirror promise; await it before a reload so the durable copy lands first.
export function saveNativePreference(key: string, value: string): Promise<void> {
  safeLocalStorage.setItem(key, value);
  return Capacitor.isNativePlatform() ? mirror(key, value) : Promise.resolve();
}

// Recovers a purged value from native Preferences into localStorage; true means the caller should
// reload so boot-time readers pick it up.
export async function restoreNativePreference(key: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || safeLocalStorage.getItem(key) !== null) return false;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value !== null && safeLocalStorage.setItem(key, value);
  } catch {
    return false;
  }
}
