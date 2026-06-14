import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { queryClient, PERSISTED_CACHE_MAX_AGE } from './api/queryClient';
import { capturePageview } from './lib/analytics';
import { syncConsentToPostHog } from './lib/consent';
import { loadPostHog } from './lib/posthog-client';
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

// Pageviews are captured here manually (PostHog's automatic capture is off). Module scope, not an
// effect, so StrictMode doesn't double-subscribe; the href dedupe drops redundant resolves
// (search-only navigations, StrictMode re-runs).
let lastPageviewHref: string | null = null;
router.subscribe('onResolved', ({ toLocation }) => {
  if (toLocation.href === lastPageviewHref) return;
  lastPageviewHref = toLocation.href;
  capturePageview(toLocation.href);
});

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

createRoot(document.getElementById('root')!).render(app);

// Load PostHog when the main thread is idle, off the critical render path. Calls made before it
// resolves are buffered; syncConsentToPostHog reapplies the stored choice once it's initialized.
const onIdle = (cb: () => void) =>
  typeof window.requestIdleCallback === 'function'
    ? window.requestIdleCallback(cb)
    : window.setTimeout(cb, 1);
onIdle(() => {
  void loadPostHog().then(syncConsentToPostHog);
});
