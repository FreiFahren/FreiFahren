import posthog from 'posthog-js';

import type { ContributeSource } from '@/lib/contribute-modal';

// Provider-agnostic analytics facade. The rest of the app calls `track(...)` and never imports the
// analytics SDK directly, so swapping PostHog for another provider is a single-file change here.
// When no VITE_POSTHOG_KEY is set the SDK is never initialized (see main.tsx) and capture() no-ops.

// Properties attached to every subsequent event (PostHog super properties), so all metrics —
// including pageviews — can be sliced by which map layer the user is on.
type SuperProperties = {
  map_layer: 'RISK' | 'LINES';
};

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
  risk_layer_toggled: { to: SuperProperties['map_layer'] };
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

/**
 * Register super properties — attached to every event sent afterwards. Used to stamp the current
 * map layer onto all events so adoption and retention can be broken down by it.
 */
export function setSuperProperties(properties: Partial<SuperProperties>): void {
  if (import.meta.env.DEV) {
    console.log('[analytics] register', properties);
  }
  posthog.register(properties);
}
