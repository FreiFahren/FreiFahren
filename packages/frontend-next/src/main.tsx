import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';
import { queryClient, PERSISTED_CACHE_MAX_AGE } from './api/queryClient';
import './lib/i18n';
import { routeTree } from './routeTree.gen';
import './index.css';

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
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
  </StrictMode>,
);
