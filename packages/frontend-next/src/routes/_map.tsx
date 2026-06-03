import { createFileRoute, Outlet } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import { LayerToggleButton } from '@/components/map/LayerToggleButton';
import { ReportButton } from '@/components/map/ReportButton';
import { ReportsOverviewButton } from '@/components/map/ReportsOverviewButton';
import { StationSearch } from '@/components/map/StationSearch';
import { StatsPopUp } from '@/components/map/StatsPopUp';

// Start downloading the map component and the maplibre-gl library in parallel
// as soon as a map route loads, so the map downloads alongside the shell
// instead of waterfalling behind it. react-map-gl lazy-imports maplibre-gl on
// mount; priming it here removes that extra round-trip. Both promises feed the
// lazy resolver below so the warm-up is not tree-shaken. The /report route does
// not mount this layout, so it stays free of the map bundle.
const mapModule = import('@/components/map/Map');
const maplibreModule = import('maplibre-gl');

const MapView = lazy(() =>
  Promise.all([mapModule, maplibreModule]).then(([m]) => ({ default: m.MapView })),
);

export const Route = createFileRoute('/_map')({
  component: () => (
    <>
      <Suspense fallback={null}>
        <MapView />
      </Suspense>
      <StationSearch />
      <StatsPopUp />
      <LayerToggleButton />
      <ReportsOverviewButton />
      <ReportButton />
      <Outlet />
    </>
  ),
});
