import { Capacitor } from '@capacitor/core';
import { CITIES, DEFAULT_CITY_SLUG, getCity, type CityConfig } from '@freifahren/cities';

import {
  RESET_AUTO_SWITCH_PARAM,
  clearAutoSwitchCityPreference,
  markResetAutoSwitchCity,
} from '@/lib/auto-switch-city';
import { restoreNativePreference, saveNativePreference } from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';
import { isPreviewBuild } from '@/lib/utils';

// Runtime city resolution. One build serves every city; the active city is resolved at boot
// from a source that depends on the platform, then held for the session. The registry
// (packages/cities) is small static data bundled into the client.

// Persisted city preference, written by the first-launch onboarding (lib/onboarding.ts) on native
// and by `?city=` on a preview. Unset (fresh install mid-onboarding) falls back to the default.
const CITY_PREFERENCE_KEY = 'freifahren.city';

const defaultCity = (): CityConfig => getCity(DEFAULT_CITY_SLUG) as CityConfig;

// Native (Capacitor): the WebView origin is capacitor://localhost, so the hostname can't
// select a city. Resolve from a persisted preference instead (localStorage is synchronous and
// available in the WebView); the onboarding flow writes it and reloads on change.
const resolveNativeCity = (): CityConfig => {
  const stored = safeLocalStorage.getItem(CITY_PREFERENCE_KEY);
  return (stored ? getCity(stored) : undefined) ?? defaultCity();
};

// Preview: one workers.dev host serves every city, so `?city=` selects one and is persisted, which
// keeps it across the reload a switch performs and across in-app navigation that drops the query.
const resolvePreviewCity = (): CityConfig | undefined => {
  if (typeof location === 'undefined') return undefined;

  const requested = new URLSearchParams(location.search).get('city');
  const city = requested ? getCity(requested) : undefined;
  if (city) {
    safeLocalStorage.setItem(CITY_PREFERENCE_KEY, city.slug);
    return city;
  }

  const stored = safeLocalStorage.getItem(CITY_PREFERENCE_KEY);
  return stored ? getCity(stored) : undefined;
};

const isLocalhost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');

// Web: the subdomain selects the city (berlin.freifahren.org -> berlin). Unknown hosts
// (freifahren.org, app./www., localhost) fall back to the default.
const resolveWebCity = (hostname: string): CityConfig => {
  const preview = isPreviewBuild ? resolvePreviewCity() : undefined;
  if (preview) return preview;

  const label = hostname.split('.')[0];
  return Object.values(CITIES).find((city) => city.subdomain === label) ?? defaultCity();
};

export function hostForCity(hostname: string, city: CityConfig): string {
  if (isLocalhost(hostname)) {
    return city.slug === DEFAULT_CITY_SLUG ? 'localhost' : `${city.subdomain}.localhost`;
  }

  const labels = hostname.split('.');
  if (labels.length < 2) return hostname;
  return [city.subdomain, ...labels.slice(1)].join('.');
}

export function urlForCity(city: CityConfig, options?: { resetAutoSwitch?: boolean }): string {
  const { protocol, hostname, port, pathname, search } = window.location;
  const params = new URLSearchParams(search);
  if (isPreviewBuild) params.set('city', city.slug);
  if (options?.resetAutoSwitch) params.set(RESET_AUTO_SWITCH_PARAM, '1');
  else params.delete(RESET_AUTO_SWITCH_PARAM);
  const query = params.toString();
  const host = isPreviewBuild ? hostname : hostForCity(hostname, city);
  return `${protocol}//${host}${port ? `:${port}` : ''}${pathname}${query ? `?${query}` : ''}`;
}

export function navigateToCity(city: CityConfig, options?: { resetAutoSwitch?: boolean }): void {
  if (options?.resetAutoSwitch) {
    clearAutoSwitchCityPreference();
    markResetAutoSwitchCity();
  }
  if (Capacitor.isNativePlatform()) {
    setCityPreference(city.slug);
    return;
  }
  window.location.assign(urlForCity(city, options));
}

// The active city for this session. The resolution source is pluggable (stored preference on
// native, hostname on web); the resolved city is fixed once the app boots.
export const currentCity: CityConfig = Capacitor.isNativePlatform()
  ? resolveNativeCity()
  : resolveWebCity(typeof location !== 'undefined' ? location.hostname : '');

export const currentCitySlug = currentCity.slug;

export function hasCityPreference(): boolean {
  return safeLocalStorage.getItem(CITY_PREFERENCE_KEY) !== null;
}

export function restoreCityPreference(): Promise<boolean> {
  return restoreNativePreference(CITY_PREFERENCE_KEY);
}

const cityPreferenceListeners = new Set<() => void>();

export function subscribeCityPreference(listener: () => void): () => void {
  cityPreferenceListeners.add(listener);
  return () => cityPreferenceListeners.delete(listener);
}

// Reload when the city changed (currentCity is fixed at boot); otherwise notify subscribers.
export function setCityPreference(slug: string): void {
  void saveNativePreference(CITY_PREFERENCE_KEY, slug).finally(() => {
    if (slug !== currentCitySlug) {
      window.location.reload();
      return;
    }
    for (const listener of cityPreferenceListeners) listener();
  });
}
