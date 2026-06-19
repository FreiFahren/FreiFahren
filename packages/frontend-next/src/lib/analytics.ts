import type { ContributeSource } from '@/lib/contribute-modal';
import type { GeolocationPermissionState } from '@/lib/location-prompt';
import { enqueuePostHog } from '@/lib/posthog-client';

// Provider-agnostic analytics facade: the app calls these helpers and never imports the SDK
// directly. Events stamp their own `timestamp` because PostHog is lazy-loaded and calls buffer
// until it's ready — otherwise a startup burst would all collapse to the SDK's init time.

export type LocationRequestTrigger = 'auto';
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
  location_permission_evaluated: { state: GeolocationPermissionState };
  location_request_started: { trigger: LocationRequestTrigger };
  location_acquired: { trigger: LocationRequestTrigger };
  location_failed: {
    trigger: LocationRequestTrigger;
    reason: 'denied' | 'unavailable' | 'timeout';
  };
  station_selected: { source: 'map' | 'search' };
  report_marker_selected: { report_age_minutes: number };
  reports_overview_opened: { report_count: number };
  reports_tab_selected: { tab: 'summary' | 'lines' | 'reports' };
  report_row_selected: { report_age_minutes: number; has_line: boolean; has_direction: boolean };
};

export function track<E extends keyof AnalyticsEvents>(
  event: E,
  properties: AnalyticsEvents[E],
): void {
  if (import.meta.env.DEV) {
    // No PostHog key in local dev, so capture() no-ops — log instead for visibility.
    console.log('[analytics]', event, properties);
  }
  const timestamp = new Date();
  enqueuePostHog((posthog) => posthog.capture(event, properties, { timestamp }));
}

// Pageviews are driven manually from the router; PostHog's automatic capture is off so they don't
// depend on SDK load timing.
export function capturePageview(url: string): void {
  if (import.meta.env.DEV) {
    console.log('[analytics] pageview', url);
  }
  const timestamp = new Date();
  enqueuePostHog((posthog) => posthog.capture('$pageview', { $current_url: url }, { timestamp }));
}

// Super properties are attached to every later event — used to stamp the current map layer so
// metrics can be broken down by it.
export function setSuperProperties(properties: Partial<SuperProperties>): void {
  if (import.meta.env.DEV) {
    console.log('[analytics] register', properties);
  }
  enqueuePostHog((posthog) => posthog.register(properties));
}

export type FeedbackType = 'feature_request' | 'bug_report' | 'general';

export const SURVEY_QUESTIONS = [
  { id: 'feedback_type', question: 'What kind of feedback is this?' },
  { id: 'feedback_message', question: 'Tell us more' },
] as const;

// The single-choice answer must match the survey's choice labels (defined in English in PostHog,
// regardless of the app's UI language) so responses aggregate under the right option.
const FEEDBACK_TYPE_CHOICE: Record<FeedbackType, string> = {
  feature_request: 'Feature request',
  bug_report: 'Bug report',
  general: 'General feedback',
};

export function captureSurveyShown(surveyId: string): void {
  if (import.meta.env.DEV) {
    console.log('[analytics] survey shown', { surveyId });
  }
  const timestamp = new Date();
  enqueuePostHog((posthog) =>
    posthog.capture('survey shown', { $survey_id: surveyId }, { timestamp }),
  );
}

export function captureSurveyDismissed(surveyId: string): void {
  if (import.meta.env.DEV) {
    console.log('[analytics] survey dismissed', { surveyId });
  }
  const timestamp = new Date();
  enqueuePostHog((posthog) =>
    posthog.capture('survey dismissed', { $survey_id: surveyId }, { timestamp }),
  );
}

export function captureSurveySent(
  surveyId: string,
  response: {
    feedbackType: FeedbackType;
    message: string;
    pageRoute: string;
    appVersion: string;
  },
): void {
  const properties = {
    $survey_id: surveyId,
    $survey_questions: SURVEY_QUESTIONS.map((q) => ({ id: q.id, question: q.question })),
    // Index-keyed responses are the format PostHog attributes to the survey's questions in order.
    $survey_response: FEEDBACK_TYPE_CHOICE[response.feedbackType],
    $survey_response_1: response.message,
    // Duplicated under plain names + context so the feedback is self-contained for Linear routing.
    feedback_type: response.feedbackType,
    feedback_message: response.message,
    page_route: response.pageRoute,
    app_version: response.appVersion,
  };
  if (import.meta.env.DEV) {
    console.log('[analytics] survey sent', properties);
  }
  const timestamp = new Date();
  enqueuePostHog((posthog) => posthog.capture('survey sent', properties, { timestamp }));
}
