import { Capacitor } from '@capacitor/core';
import type { PostHog } from 'posthog-js';

import { currentCitySlug } from './city';
import { safeLocalStorage } from './safe-storage';
import { optionalEnv } from './utils';

// Web uses a cookie, not localStorage: localStorage is per-origin, so a visitor crossing city
// subdomains would land on empty storage and be minted a new anonymous id. The cookie is shared
// across subdomains (see cross_subdomain_cookie), so the id survives the switch. Native keeps
// localStorage because cookies are unreliable in the WKWebView (capacitor://localhost).
export const PERSISTENT_PERSISTENCE = Capacitor.isNativePlatform() ? 'localStorage' : 'cookie';

// posthog-js is lazy-loaded after first paint to keep it out of the eager bundle. Calls made before
// it finishes loading are buffered here and flushed in order, so startup events aren't lost.

type PostHogOp = (ph: PostHog) => void;

let instance: PostHog | null = null;
let disabled = false;
let loadPromise: Promise<void> | null = null;
const queue: PostHogOp[] = [];
// Cap the buffer so a session that never loads the SDK (dev without a key) can't grow it unbounded.
const MAX_QUEUED = 500;
let flagAccountId: string | null = null;
// Set from init's loaded hook, which runs before `instance` (awaiting registerVersion) is ready.
let flagTarget: PostHog | null = null;

// Before init the id is only stored; the loaded hook applies it ahead of the first /flags request.
export function setPostHogFlagAccount(next: string | null): void {
  if (next === flagAccountId) return;
  flagAccountId = next;
  if (flagTarget) syncPostHogFlagAccount(flagTarget);
}

// An evaluation-only property: it reloads flags but neither identifies the account in analytics
// nor writes to its person profile.
export function syncPostHogFlagAccount(posthog: PostHog): void {
  posthog.setPersonPropertiesForFlags({ account_id: flagAccountId });
}

export function getDistinctId(): string | undefined {
  const distinctId = instance?.get_distinct_id();
  return typeof distinctId === 'string' && distinctId.length > 0 ? distinctId : undefined;
}

export function enqueuePostHog(op: PostHogOp): void {
  if (instance) {
    op(instance);
    return;
  }
  if (disabled) return;
  if (queue.length >= MAX_QUEUED) queue.shift();
  queue.push(op);
}

// On native, app_version/app_build track the store binary; bundle_build tracks the OTA bundle.
async function registerVersion(posthog: PostHog): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { App } = await import('@capacitor/app');
      const { version, build } = await App.getInfo();
      posthog.register({ app_version: version, app_build: build, bundle_build: __BUILD_ID__ });
    } else {
      posthog.register({ app_version: __BUILD_ID__, bundle_build: __BUILD_ID__ });
    }
  } catch {
    /* ignore */
  }
}

// Ids stored before the user declined, or by builds that persisted before any choice was made.
// Without consent nothing may stay on the device (§ 25 TDDDG), so they are dropped before init.
function clearPersistedPostHog(apiKey: string): void {
  const labels = window.location.hostname.split('.');
  // cross_subdomain_cookie scopes the cookie to the registrable domain, e.g. .freifahren.org.
  const parentDomain = labels.length > 2 ? `; domain=.${labels.slice(-2).join('.')}` : '';
  for (const name of [`ph_${apiKey}_posthog`, `__ph_opt_in_out_${apiKey}`]) {
    safeLocalStorage.removeItem(name);
    document.cookie = `${name}=; Max-Age=0; path=/`;
    if (parentDomain) document.cookie = `${name}=; Max-Age=0; path=/${parentDomain}`;
  }
}

// `persistent` is true only once the user has allowed cookies; until then PostHog keeps its id in
// memory, so a visit that hasn't decided yet leaves nothing on the device.
export function loadPostHog(persistent: boolean): Promise<void> {
  if (loadPromise) return loadPromise;

  const apiKey = optionalEnv('VITE_POSTHOG_KEY');
  if (!apiKey) {
    disabled = true;
    queue.length = 0;
    loadPromise = Promise.resolve();
    return loadPromise;
  }
  const apiHost = optionalEnv('VITE_POSTHOG_HOST') ?? 'https://eu.i.posthog.com';

  loadPromise = import('posthog-js').then(async ({ default: posthog }) => {
    if (!persistent) clearPersistedPostHog(apiKey);
    posthog.init(apiKey, {
      api_host: apiHost,
      // api_host is our reverse proxy in prod; keep PostHog UI/toolbar links on the real app.
      ui_host: 'https://eu.posthog.com',
      defaults: '2025-05-24',
      // We never call identify() (accounts only feed flag evaluation), so under the default
      // 'identified_only' mode PostHog ingests every event personless and builds no person profiles
      // at all — which leaves lifecycle, retention, and stickiness permanently empty. 'always' lets
      // the persistent anonymous distinct_id form a person profile so returning visits are
      // measurable. Consent still governs persistence: the id is only persisted once cookies are
      // allowed (see consent.ts), so undecided and declined users stay un-retained by design, and
      // respect_dnt keeps DNT users out.
      person_profiles: 'always',
      persistence: persistent ? PERSISTENT_PERSISTENCE : 'memory',
      // Explicit so the cross-subdomain intent can't be silently flipped to per-host. posthog-js
      // also derives this for registrable domains; it stays host-only on single-label hosts.
      cross_subdomain_cookie: true,
      autocapture: false,
      capture_performance: false,
      disable_session_recording: true,
      respect_dnt: true,
      // Pageviews are captured manually from the router so they don't depend on when this
      // lazily-loaded SDK initializes; capture_pageleave stays on by default.
      capture_pageview: false,
      // Replace persisted overrides before any startup flag request can use a previous account.
      loaded: () => {
        flagTarget = posthog;
        syncPostHogFlagAccount(posthog);
      },
    });
    // Stamp every event with the runtime so funnels can be split by web vs native.
    // city is a registered super property (not derived from $host) because native
    // (Capacitor) events have no meaningful host. Resolved at boot from the hostname
    // (web) or the stored preference (native).
    posthog.register({
      platform: Capacitor.getPlatform(),
      is_native: Capacitor.isNativePlatform(),
      city: currentCitySlug,
    });
    // Native version discovery awaits @capacitor/app. Finish it before startup events become
    // observable so the first pageview has the same super properties as later events.
    await registerVersion(posthog);
    instance = posthog;
    for (const op of queue) op(posthog);
    queue.length = 0;
  });
  // Analytics is non-critical: a content blocker or a stale chunk can make the dynamic import
  // resolve empty (destructuring `default` then throws) or reject outright. Swallow it and disable
  // capture so it doesn't surface as an unhandled rejection.
  loadPromise = loadPromise.catch(() => {
    disabled = true;
    queue.length = 0;
  });
  return loadPromise;
}
