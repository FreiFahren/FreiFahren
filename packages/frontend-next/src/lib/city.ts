import { Capacitor } from '@capacitor/core';
import { CITIES, DEFAULT_CITY_SLUG, getCity, type CityConfig } from '@freifahren/cities';

import { restoreNativePreference, saveNativePreference } from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';

// Runtime city resolution. One build serves every city; the active city is resolved at boot
// from a source that depends on the platform, then held for the session. The registry
// (packages/cities) is small static data bundled into the client.

// Persisted native city preference, written by the first-launch onboarding (lib/onboarding.ts).
// Unset (fresh install mid-onboarding) falls back to the default.
const NATIVE_CITY_PREFERENCE_KEY = 'freifahren.city';

const defaultCity = (): CityConfig => getCity(DEFAULT_CITY_SLUG) as CityConfig;

// Native (Capacitor): the WebView origin is capacitor://localhost, so the hostname can't
// select a city. Resolve from a persisted preference instead (localStorage is synchronous and
// available in the WebView); the onboarding flow writes it and reloads on change.
const resolveNativeCity = (): CityConfig => {
  const stored = safeLocalStorage.getItem(NATIVE_CITY_PREFERENCE_KEY);
  return (stored ? getCity(stored) : undefined) ?? defaultCity();
};

// Web: the subdomain selects the city (berlin.freifahren.org -> berlin). Unknown hosts
// (freifahren.org, app./www., localhost, preview deploys) fall back to the default.
const resolveWebCity = (hostname: string): CityConfig => {
  const label = hostname.split('.')[0];
  return Object.values(CITIES).find((city) => city.subdomain === label) ?? defaultCity();
};

// The active city for this session. The resolution source is pluggable (stored preference on
// native, hostname on web); the resolved city is fixed once the app boots.
export const currentCity: CityConfig = Capacitor.isNativePlatform()
  ? resolveNativeCity()
  : resolveWebCity(typeof location !== 'undefined' ? location.hostname : '');

export const currentCitySlug = currentCity.slug;

export function hasCityPreference(): boolean {
  return safeLocalStorage.getItem(NATIVE_CITY_PREFERENCE_KEY) !== null;
}

export function restoreCityPreference(): Promise<boolean> {
  return restoreNativePreference(NATIVE_CITY_PREFERENCE_KEY);
}

const cityPreferenceListeners = new Set<() => void>();

export function subscribeCityPreference(listener: () => void): () => void {
  cityPreferenceListeners.add(listener);
  return () => cityPreferenceListeners.delete(listener);
}

// Reload when the city changed (currentCity is fixed at boot); otherwise notify subscribers.
export function setCityPreference(slug: string): void {
  void saveNativePreference(NATIVE_CITY_PREFERENCE_KEY, slug).finally(() => {
    if (slug !== currentCitySlug) {
      window.location.reload();
      return;
    }
    for (const listener of cityPreferenceListeners) listener();
  });
}
