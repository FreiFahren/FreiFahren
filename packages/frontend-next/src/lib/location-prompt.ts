// Coordinates when the map may ask for the browser's location permission. The native
// geolocation prompt is one-shot per origin (a denial is sticky and cannot be re-triggered),
// so we gate it behind an in-app soft-ask and remember just enough state to avoid re-nagging.

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

// Persisted opt-in: once the user has allowed (or we have seen a successful fix), remember it so
// browsers without the Permissions API (iOS Safari) are not soft-asked again on a later visit.
const OPT_IN_KEY = 'locationOptIn';

export function isLocationOptedIn(): boolean {
  try {
    return localStorage.getItem(OPT_IN_KEY) === 'true';
  } catch {
    // Private mode / disabled storage: treat as not opted in so the soft-ask can still appear.
    return false;
  }
}

export function markLocationOptedIn(): void {
  try {
    localStorage.setItem(OPT_IN_KEY, 'true');
  } catch {
    // Ignore storage failures; the worst case is asking again on a future visit.
  }
}
