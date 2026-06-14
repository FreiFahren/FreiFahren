import { useSyncExternalStore } from 'react';

import { captureSurveyShown } from '@/lib/analytics';
import { optionalEnv } from '@/lib/utils';

// Which in-app entry point opened the feedback modal. Carried through so we can see which surface
// drives feedback once submissions land in PostHog.
export type FeedbackSource = 'report_form' | 'reports_overview' | 'report_success' | 'settings';

// The PostHog survey responses are attributed to. Set VITE_POSTHOG_FEEDBACK_SURVEY_ID to the id of
// an API-type survey created in the project. When unset (e.g. local dev) we still emit the events
// under this fallback id so the funnel is visible in the DEV console — they just won't attach to a
// real survey until the id is wired up.
export const FEEDBACK_SURVEY_ID = optionalEnv('VITE_POSTHOG_FEEDBACK_SURVEY_ID') ?? 'app-feedback';

let open = false;
let source: FeedbackSource = 'settings';
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openFeedbackModal(from: FeedbackSource): void {
  source = from;
  open = true;
  notify();
  captureSurveyShown(FEEDBACK_SURVEY_ID);
}

export function getFeedbackSource(): FeedbackSource {
  return source;
}

export function closeFeedbackModal(): void {
  open = false;
  notify();
}

export function useFeedbackModalOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}
