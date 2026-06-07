import { useRouterState } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';

import { cn } from '@/lib/utils';

// Load the map + maplibre-gl in parallel only once the map first mounts, keeping the
// heavy bundle out of the shell and off map-less routes (/report, /privacy, /impressum).
const MapView = lazy(() =>
  Promise.all([import('@/components/map/Map'), import('maplibre-gl')]).then(([m]) => ({
    default: m.MapView,
  })),
);

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
