import { Capacitor } from '@capacitor/core';

// How long after the map loads before the native permission dialog fires (unless already granted).
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
