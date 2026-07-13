import { useSyncExternalStore } from 'react';

import { enqueuePostHog } from '@/lib/posthog-client';

// PostHog feature flags read through the same lazy-loaded client as analytics, so components never
// touch the SDK directly. Flags gate UI that ships in the bundle but isn't launched yet; the value
// is false until the SDK loads and PostHog resolves flags, and false forever when analytics is
// disabled (no key, or a 'denied'/DNT session that never initializes the SDK). Fail-closed: a
// gated feature stays hidden unless PostHog affirmatively turns it on.
export const FEATURE_FLAGS = {
  citySwitcher: 'city-switcher',
} as const;

type FlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

const values = new Map<FlagKey, boolean>();
const listeners = new Set<() => void>();
let subscribed = false;

function notify(): void {
  for (const listener of listeners) listener();
}

// Wire up to PostHog once, on first subscription. onFeatureFlags fires whenever flags (re)load —
// after the SDK import resolves, after a reload, and after a local override in the toolbar — so the
// store tracks every change. Buffered until the SDK is ready; dropped if analytics is disabled.
function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;
  enqueuePostHog((posthog) => {
    const sync = () => {
      let changed = false;
      for (const key of Object.values(FEATURE_FLAGS)) {
        const next = posthog.isFeatureEnabled(key) ?? false;
        if (values.get(key) !== next) {
          values.set(key, next);
          changed = true;
        }
      }
      if (changed) notify();
    };
    posthog.onFeatureFlags(sync);
    sync();
  });
}

export function subscribeToFeatureFlags(listener: () => void): () => void {
  ensureSubscribed();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// In dev every flag reads on, so gated work is visible locally without touching PostHog. In
// prod the value comes from the resolved flag (false until PostHog turns it on).
export function getFeatureFlag(flag: FlagKey): boolean {
  ensureSubscribed();
  return import.meta.env.DEV ? true : (values.get(flag) ?? false);
}

export function useFeatureFlag(flag: FlagKey): boolean {
  return useSyncExternalStore(subscribeToFeatureFlags, () => getFeatureFlag(flag));
}
