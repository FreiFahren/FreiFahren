import type { PostHog } from 'posthog-js';

import { optionalEnv } from './utils';

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
      autocapture: false,
      capture_performance: false,
      disable_session_recording: true,
      respect_dnt: true,
      // Pageviews are captured manually from the router so they don't depend on when this
      // lazily-loaded SDK initializes; capture_pageleave stays on by default.
      capture_pageview: false,
    });
    instance = posthog;
    for (const op of queue) op(posthog);
    queue.length = 0;
  });
  return loadPromise;
}
