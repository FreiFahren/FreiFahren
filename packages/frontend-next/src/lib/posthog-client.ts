import { Capacitor } from '@capacitor/core';
import type { PostHog } from 'posthog-js';

import { optionalEnv } from './utils';

// In the native WKWebView (capacitor://localhost) cookies are unreliable, so persistent capture uses
// localStorage only; the web keeps the cookie too. Consent ('denied' -> memory) still applies on top.
export const PERSISTENT_PERSISTENCE = Capacitor.isNativePlatform()
  ? 'localStorage'
  : 'localStorage+cookie';

// posthog-js is lazy-loaded after first paint to keep it out of the eager bundle. Calls made before
// it finishes loading are buffered here and flushed in order, so startup events aren't lost.

type PostHogOp = (ph: PostHog) => void;

let instance: PostHog | null = null;
let disabled = false;
let loadPromise: Promise<void> | null = null;
const queue: PostHogOp[] = [];
// Cap the buffer so a session that never loads the SDK (dev without a key) can't grow it unbounded.
const MAX_QUEUED = 500;

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

export function loadPostHog(): Promise<void> {
  if (loadPromise) return loadPromise;

  const apiKey = optionalEnv('VITE_POSTHOG_KEY');
  if (!apiKey) {
    disabled = true;
    queue.length = 0;
    loadPromise = Promise.resolve();
    return loadPromise;
  }
  const apiHost = optionalEnv('VITE_POSTHOG_HOST') ?? 'https://eu.i.posthog.com';

  loadPromise = import('posthog-js').then(({ default: posthog }) => {
    posthog.init(apiKey, {
      api_host: apiHost,
      defaults: '2025-05-24',
      persistence: PERSISTENT_PERSISTENCE,
      autocapture: false,
      capture_performance: false,
      disable_session_recording: true,
      respect_dnt: true,
      // Pageviews are captured manually from the router so they don't depend on when this
      // lazily-loaded SDK initializes; capture_pageleave stays on by default.
      capture_pageview: false,
    });
    // Stamp every event with the runtime so funnels can be split by web vs native.
    posthog.register({
      platform: Capacitor.getPlatform(),
      is_native: Capacitor.isNativePlatform(),
    });
    instance = posthog;
    for (const op of queue) op(posthog);
    queue.length = 0;
    // Trails the register above because it awaits a native plugin call.
    void registerVersion(posthog);
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
