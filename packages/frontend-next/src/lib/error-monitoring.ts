import { Capacitor } from '@capacitor/core';
import * as SentryReact from '@sentry/react';

import { optionalEnv } from '@/lib/utils';

// Provider-agnostic error-monitoring facade. The rest of the app never imports the Sentry SDK
// directly — swapping providers is a single-file change here, mirroring lib/analytics.ts. When no
// VITE_SENTRY_DSN is set (e.g. local dev) the SDK is never initialized and nothing is ever sent.

function doNotTrackEnabled(): boolean {
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  // Standard signal plus the legacy IE/old-Firefox vendor-prefixed variants.
  const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack;
  return dnt === '1' || dnt === 'yes';
}

export function initErrorMonitoring(): void {
  const dsn = optionalEnv('VITE_SENTRY_DSN');
  // No DSN configured (local dev) or the user opted out via Do Not Track: stay uninitialized so
  // every capture is a silent no-op and nothing leaves the device.
  if (!dsn || doNotTrackEnabled()) return;

  const options: Parameters<typeof SentryReact.init>[0] = {
    dsn,
    // The build timestamp doubles as the release/app version so issues group by deploy. Matches the
    // "App version" data point disclosed in the privacy policy.
    release: __BUILD_ID__,
    environment: import.meta.env.MODE,
    // Tag every event with the runtime so native (ios/android) and web issues are filterable.
    // city is hardcoded to berlin for now; switches to hostname-resolved once runtime city
    // resolution lands on the frontend.
    initialScope: { tags: { platform: Capacitor.getPlatform(), city: 'berlin' } },
    // No IP address, cookies, or request payloads — see the file header.
    sendDefaultPii: false,
    // Performance: capture page-load/navigation timing and Web Vitals (LCP, INP, CLS, ...) on a 50%
    // sample. These spans carry only in-app route + own-API URLs (no personal data); disclosed in
    // the privacy policy alongside error diagnostics.
    integrations: [SentryReact.browserTracingIntegration()],
    tracesSampler: (samplingContext) => (samplingContext.name === 'Submit Report' ? 1.0 : 0.5),
    // Same-origin only: never attach sentry-trace/baggage headers to the cross-origin API (its CORS
    // config doesn't allow them, and we don't do distributed tracing into the backend).
    tracePropagationTargets: ['localhost', /^\//],
  };

  if (__CAPACITOR__) {
    // Native build: route init through @sentry/capacitor so we also capture native (Swift) crashes,
    // not just WebView JS errors. It wraps the React SDK — SentryReact.init is passed as the sibling.
    // Dynamically imported so it (and the native bridge) stays out of the web bundle.
    void import('@sentry/capacitor').then((SentryCapacitor) => {
      SentryCapacitor.init(options, SentryReact.init);
    });
    return;
  }

  SentryReact.init(options);
}

// Wrap a user action so the API calls inside it are recorded as a trace with timing. The
// auto-instrumented fetch spans only attach to an active root span (pageload/navigation), which
// has usually closed by the time the user triggers an action — so without this the request is
// never captured. The action name doubles as the tracesSampler key (see init). When Sentry is
// uninitialized (local dev / Do Not Track) startSpan still runs the callback, so this is a no-op.
export function traceAction<T>(name: string, callback: () => Promise<T>): Promise<T> {
  return SentryReact.startSpan({ name, op: 'ui.action.submit' }, callback);
}
