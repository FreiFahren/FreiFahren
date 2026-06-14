import * as Sentry from '@sentry/react';

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

  Sentry.init({
    dsn,
    // The build timestamp doubles as the release/app version so issues group by deploy. Matches the
    // "App version" data point disclosed in the privacy policy.
    release: __BUILD_ID__,
    environment: import.meta.env.MODE,
    // No IP address, cookies, or request payloads — see the file header.
    sendDefaultPii: false,
    // Performance: capture page-load/navigation timing and Web Vitals (LCP, INP, CLS, ...) on a 10%
    // sample. These spans carry only in-app route + own-API URLs (no personal data); disclosed in
    // the privacy policy alongside error diagnostics.
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    // Same-origin only: never attach sentry-trace/baggage headers to the cross-origin API (its CORS
    // config doesn't allow them, and we don't do distributed tracing into the backend).
    tracePropagationTargets: ['localhost', /^\//],
  });
}
