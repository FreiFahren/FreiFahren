import posthog from 'posthog-js';

// Provider-agnostic analytics facade. The rest of the app calls `track(...)` and never imports the
// analytics SDK directly, so swapping PostHog for another provider is a single-file change here.
// When no VITE_POSTHOG_KEY is set the SDK is never initialized (see main.tsx) and capture() no-ops.

/**
 * The events we send and their property shape. Add an entry here to introduce a new event — the
 * `track()` signature is derived from this map, so call sites get autocomplete and type-checking on
 * both the event name and its properties.
 */
type AnalyticsEvents = {
  report_submitted: {
    stationId: string;
    lineId: string | null;
    directionId: string | null;
  };
};

export function track<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
): void {
  posthog.capture(event, properties);
}
