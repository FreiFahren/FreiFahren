import { useSyncExternalStore } from 'react';

import { i18n } from '@/lib/i18n';
import { removeNativePreference, saveNativePreference } from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';

// Explicit override on top of i18next's own auto-detection (browser/WebView locale, see
// lib/i18n.ts). Stored separately from i18next-browser-languagedetector's own cache (the
// 'i18nextLng' localStorage key it writes on every languageChanged) so "Auto" can be told apart
// from "the user explicitly picked the language that happens to match the detected one" — and so
// switching back to "Auto" can wipe the detector's cache and force a fresh redetection instead of
// reapplying a stale cached value.
export const SUPPORTED_LANGUAGES = ['en', 'de'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type LanguagePreference = SupportedLanguage | 'auto';

const LANGUAGE_PREFERENCE_KEY = 'freifahren.language';
const DETECTOR_CACHE_KEY = 'i18nextLng';

function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value ?? '');
}

function storedPreference(): LanguagePreference {
  const stored = safeLocalStorage.getItem(LANGUAGE_PREFERENCE_KEY);
  return isSupportedLanguage(stored) ? stored : 'auto';
}

let preference = storedPreference();
// Apply an explicit override at boot; 'auto' leaves i18next's own detected language in place.
if (preference !== 'auto') void i18n.changeLanguage(preference);

const listeners = new Set<() => void>();
function notify(): void {
  for (const listener of listeners) listener();
}

export function getLanguagePreference(): LanguagePreference {
  return preference;
}

export function useLanguagePreference(): LanguagePreference {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getLanguagePreference);
}

// Picking 'en'/'de' applies immediately, no reload needed. 'auto' clears both our preference and
// the language detector's own cache, then reloads so the detector re-derives the language from
// the current browser/system locale, exactly as at a fresh boot.
export function setLanguagePreference(next: LanguagePreference): void {
  if (next === preference) return;
  preference = next;

  if (next === 'auto') {
    void Promise.all([
      removeNativePreference(LANGUAGE_PREFERENCE_KEY),
      removeNativePreference(DETECTOR_CACHE_KEY),
    ]).finally(() => window.location.reload());
    return;
  }

  void saveNativePreference(LANGUAGE_PREFERENCE_KEY, next);
  void i18n.changeLanguage(next);
  notify();
}
