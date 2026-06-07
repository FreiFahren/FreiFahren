// Coordinates when the map may ask for the browser's location permission. We never call the
// geolocation API on a hint — only when it is reliably 'granted' (silent) or the user explicitly
// taps Allow — so we never surface the native prompt before our in-app soft-ask.

// Let users orient themselves on the map before the prompt interrupts them.
export const LOCATION_PROMPT_DELAY_MS = 15_000;

export type GeolocationPermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export async function queryGeolocationPermission(): Promise<GeolocationPermissionState> {
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unsupported';
  }
}

// "Not now" suppresses the soft-ask for the current session only ("not now" means "later"),
// so this is intentionally in-memory and resets on reload.
let dismissed = false;

export function isLocationPromptDismissed(): boolean {
  return dismissed;
}

export function dismissLocationPrompt(): void {
  dismissed = true;
}
