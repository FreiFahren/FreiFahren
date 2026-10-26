import { useSyncExternalStore } from 'react';

import { enqueuePostHog } from '@/lib/posthog-client';
import { isPreviewBuild, optionalEnv } from '@/lib/utils';

// PostHog feature flags read through the same lazy-loaded client as analytics, so components never
// touch the SDK directly. Flags gate UI that ships in the bundle but isn't launched yet; the value
// is false until the SDK loads and PostHog resolves flags, and false forever when analytics is
// disabled (no key, or a 'denied'/DNT session that never initializes the SDK). Fail-closed: a
// gated feature stays hidden unless PostHog affirmatively turns it on. Signed-in accounts can be
// targeted through the `account_id` person property (see setPostHogFlagAccount).
export const FEATURE_FLAGS = {
  citySwitcher: 'city-switcher',
  contributeModalTiming: 'contribute-modal-timing',
  announcements: 'announcements',
  accounts: 'accounts',
  fund: 'fund',
} as const;

type FlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export type ContributeModalTimingVariant = 'control' | 'test';

const values = new Map<FlagKey, boolean>();
const variants = new Map<FlagKey, string | boolean>();
const listeners = new Set<() => void>();
let subscribed = false;
// Keyless dev and PR previews show every feature; setting a key there exercises real targeting.
const bypassFlags = (import.meta.env.DEV || isPreviewBuild) && !optionalEnv('VITE_POSTHOG_KEY');

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
        const nextVariant = posthog.getFeatureFlag(key) ?? false;
        if (values.get(key) !== next) {
          values.set(key, next);
          changed = true;
        }
        if (variants.get(key) !== nextVariant) {
          variants.set(key, nextVariant);
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

export function getFeatureFlag(flag: FlagKey): boolean {
  ensureSubscribed();
  return bypassFlags || (values.get(flag) ?? false);
}

export function getFeatureFlagVariant(
  flag: typeof FEATURE_FLAGS.contributeModalTiming,
): ContributeModalTimingVariant | false {
  ensureSubscribed();
  if (bypassFlags) return 'control';
  const value = variants.get(flag);
  return value === 'control' || value === 'test' ? value : false;
}

export function useFeatureFlag(flag: FlagKey): boolean {
  return useSyncExternalStore(subscribeToFeatureFlags, () => getFeatureFlag(flag));
}
