import { useRouterState } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';

import { cn } from '@/lib/utils';

// Load the map + maplibre-gl in parallel only once the map first mounts, keeping the
// heavy bundle out of the shell and off map-less routes (/report, /privacy, /impressum).
const importMap = () =>
  Promise.all([import('@/components/map/Map'), import('maplibre-gl')]).then(([m]) => ({
    default: m.MapView,
  }));

const MapView = lazy(importMap);

// When the app *boots* directly onto a map page (the common case: the live map at `/`, and the
// `/station/:id` deep-links), kick the heavy map chunk off immediately — in parallel with the
// main bundle parsing and React mounting — instead of waiting for first render to discover the
// dynamic import. That removes a ~0.5-1s serial step from the critical path to the map's first
// paint. The import is module-cached, so the lazy() call below reuses this same in-flight fetch.
// Other map routes (e.g. /settings) keep the lazy-on-mount path; they're rarely the entry point.
if (typeof window !== 'undefined') {
  const { pathname } = window.location;
  if (pathname === '/' || pathname.startsWith('/station/')) void importMap();
}

// Map routes share the `/_map` id prefix; the `/reports` overview does not.
const selectOnMapRoute = (s: { matches: { routeId: string }[] }) =>
  s.matches.some((m) => m.routeId.startsWith('/_map'));

/**
 * Hosts a single map instance at the app shell so it survives navigation. The map mounts
 * on the first map-route visit and stays mounted for the session; off-map routes only
 * hide it, so returning is instant — no remount, no tile/style refetch.
 */
export function PersistentMapView() {
  const onMapRoute = useRouterState({ select: selectOnMapRoute });
  const [mounted, setMounted] = useState(false);
  if (onMapRoute && !mounted) setMounted(true);

  if (!mounted) return null;

  // `invisible` (not `hidden`) keeps the full-viewport map sized and its WebGL context
  // alive, and blocks pointer events while off-map.
  return (
    <div className={cn(!onMapRoute && 'invisible')}>
      <Suspense fallback={null}>
        <MapView />
      </Suspense>
    </div>
  );
}
