import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { PostHogProvider } from 'posthog-js/react';
import { queryClient, PERSISTED_CACHE_MAX_AGE } from './api/queryClient';
import { optionalEnv } from './lib/utils';
import { initErrorMonitoring } from './lib/error-monitoring';
import './lib/i18n';
import { routeTree } from './routeTree.gen';
import './index.css';

// Initialize error monitoring before anything else renders so errors during startup are captured.
// No-ops without VITE_SENTRY_DSN or when Do Not Track is set (see lib/error-monitoring.ts).
initErrorMonitoring();

// Persist the React Query cache to IndexedDB so the last-known transit data, reports, and risk
// survive a cold start with no network — the user opens the app in a tunnel and still sees the
// map populated. IndexedDB (not localStorage) because the transit-segments GeoJSON can exceed the
// ~5 MB localStorage quota. A restore is not a fetch, so it never triggers the "Reports updated"
// toast (see useReportsRefreshSignal); the background refetch fires it only when it actually
// succeeds online.
const persister = createAsyncStoragePersister({
  key: 'freifahren-query-cache',
  storage: {
    getItem: (k) => get<string>(k).then((v) => v ?? null),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
});

// 'viewport' preloads each <Link>'s route (chunk + loader data) once it's on screen via an
// IntersectionObserver — so the pages reachable from the current view warm in the background
const router = createRouter({ routeTree, defaultPreload: 'viewport' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const posthogKey = optionalEnv('VITE_POSTHOG_KEY');
const posthogHost = optionalEnv('VITE_POSTHOG_HOST') ?? 'https://eu.i.posthog.com';

const app = (
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      // On a PWA cold start the cache is rehydrated from IndexedDB with each query's original
      // `dataUpdatedAt`, so a reload within `staleTime` would serve a stale snapshot with no
      // network request. `onSuccess` fires after restore but while queries are still paused
      // (`isRestoring`), so invalidating here only marks them stale — no fetch yet. When the
      // queries unpause, the default staleness-gated `refetchOnMount` fires exactly one deduped
      // refetch per key, regardless of how many observers mount. This is stale-while-revalidate
      // without the per-observer fan-out that `refetchOnMount: 'always'` would cause.
      onSuccess={() => {
        void queryClient.invalidateQueries();
      }}
      persistOptions={{
        persister,
        // persisted cache from an older build so a changed query shape can't hydrate incompatibly.
        maxAge: PERSISTED_CACHE_MAX_AGE,
        buster: __BUILD_ID__,
        dehydrateOptions: {
          // Persist any query that holds data, not just status==='success' (the default). When a
          // user is offline, the periodic refetch fails and React Query demotes the query to
          // 'error' while keeping its last data in memory — the success-only default would then
          // refuse to persist it and overwrite the good snapshot with an empty one, so the data
          // would vanish after a couple of reloads. Keying on `data` keeps the last-known reports/
          // risk/transit across cold starts; once back online the refetch succeeds and refreshes.
          shouldDehydrateQuery: (query) => query.state.data !== undefined,
        },
      }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>
);

createRoot(document.getElementById('root')!).render(
  posthogKey ? (
    <PostHogProvider
      apiKey={posthogKey}
      // Analytics config (see src/lib/consent.ts for the opt-out flow):
      // - autocapture off: no DOM click/input capture; domain events go through track().
      // - Capture is ON by default (opt-out model): the banner is informational and lets users opt
      //   out via posthog.opt_out_capturing(). This gives retention + cross-session funnels out of
      //   the box. NOTE: opt-out (vs opt-in) for cookie-based analytics is a deliberate product/
      //   legal choice — reflect it in the privacy policy's legal basis.
      // - session recording stays off; DNT is honored as an automatic opt-out signal.
      // - capture_performance off: no web-vitals/network capture even before remote config loads
      //   (the '2025-05-24' defaults would otherwise enable it at init); matches the project settings.
      options={{
        api_host: posthogHost,
        defaults: '2025-05-24',
        autocapture: false,
        capture_performance: false,
        disable_session_recording: true,
        respect_dnt: true,
      }}
    >
      {app}
    </PostHogProvider>
  ) : (
    app
  ),
);
