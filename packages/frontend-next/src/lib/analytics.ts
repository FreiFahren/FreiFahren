import posthog from 'posthog-js';

import type { ContributeSource } from '@/lib/contribute-modal';

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
  // Contribution funnel. `source` records which entry point opened the modal so we can compare the
  // settings button against the prompt shown after a successful report. The donation itself happens
  // off-site (Stripe redirect / manual bank transfer), so these events measure intent, not completion.
  contribute_modal_opened: { source: ContributeSource };
  contribute_method_viewed: { method: 'stripe' | 'bank_transfer' };
  contribute_stripe_clicked: { source: ContributeSource };
  contribute_dismissed: { source: ContributeSource };
};

export function track<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
): void {
  if (import.meta.env.DEV) {
    // In development we usually run without a PostHog key, so capture() no-ops. Log instead so the
    // funnel events are visible in the console while wiring up tracking.
    console.log('[analytics]', event, properties);
  }
  posthog.capture(event, properties);
}
