import { Capacitor } from '@capacitor/core';

import { useSyncExternalStore } from 'react';

import { track } from '@/lib/analytics';
import { safeLocalStorage } from '@/lib/safe-storage';

// Let first-time users orient themselves before the in-app explanation appears.
export const LOCATION_PROMPT_DELAY_MS = 10_000;

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

// Capacitor's PermissionState ('prompt' | 'prompt-with-rationale' | 'granted' | 'denied') mapped to
// ours; both rationale and first-ask collapse to 'prompt'.
function fromCapacitor(state: string): GeolocationPermissionState {
  if (state === 'granted' || state === 'denied') return state;
  return 'prompt';
}

export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  // In the native WKWebView the Permissions API is unreliable; ask CoreLocation via the plugin.
  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      return fromCapacitor((await Geolocation.checkPermissions()).location);
    } catch {
      return 'unsupported';
    }
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unsupported';
  }
}

const PREVIOUS_SUCCESS_KEY = 'locationPreviouslySucceeded';

export function rememberLocationSuccess(): void {
  safeLocalStorage.setItem(PREVIOUS_SUCCESS_KEY, 'true');
}

export function forgetLocationSuccess(): void {
  safeLocalStorage.removeItem(PREVIOUS_SUCCESS_KEY);
}

export async function getLocationSharingAction(): Promise<'request' | 'denied' | 'prompt'> {
  const permission = await queryGeolocationPermission();
  track('location_permission_evaluated', { state: permission });
  if (permission === 'denied') {
    forgetLocationSuccess();
    return 'denied';
  }
  if (permission === 'granted') return 'request';

  // Safari can report "prompt" until geolocation is used on this page, even with an existing
  // grant. Previous success lets returning web users skip our explanation; an expired grant
  // may still cause Safari to show its own prompt. Native permission checks remain authoritative.
  if (!Capacitor.isNativePlatform() && safeLocalStorage.getItem(PREVIOUS_SUCCESS_KEY) === 'true') {
    return 'request';
  }
  return 'prompt';
}

// Surfaces the OS location dialog on native and resolves to the resulting state. On the web this is
// a no-op ('unsupported') — there the navigator.geolocation call itself triggers the browser prompt.
export async function requestGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    return fromCapacitor((await Geolocation.requestPermissions()).location);
  } catch {
    return 'unsupported';
  }
}

// "Not now" lasts only for this session. The report flow may still ask again when location has a
// clear, immediate purpose.
let mapPromptDismissed = false;

export function isMapLocationPromptDismissed(): boolean {
  return mapPromptDismissed;
}

export function dismissMapLocationPrompt(): void {
  mapPromptDismissed = true;
}

export type LocationPromptSource = 'map' | 'report';

let activePrompt: LocationPromptSource | null = null;
const promptListeners = new Set<() => void>();

function notifyPromptListeners(): void {
  for (const listener of promptListeners) listener();
}

export function openLocationPrompt(source: LocationPromptSource): void {
  activePrompt = source;
  notifyPromptListeners();
}

export function closeLocationPrompt(source: LocationPromptSource): void {
  if (activePrompt !== source) return;
  activePrompt = null;
  notifyPromptListeners();
}

export function useActiveLocationPrompt(): LocationPromptSource | null {
  return useSyncExternalStore(
    (listener) => {
      promptListeners.add(listener);
      return () => promptListeners.delete(listener);
    },
    () => activePrompt,
  );
}
