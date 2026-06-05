import { createFileRoute, Outlet } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';

import { LayerToggleButton } from '@/components/map/LayerToggleButton';
import { ReportButton } from '@/components/map/ReportButton';
import { ReportsOverviewButton } from '@/components/map/ReportsOverviewButton';
import { SettingsButton } from '@/components/map/SettingsButton';
import { StationSearch } from '@/components/map/StationSearch';
import { StatsPopUp } from '@/components/map/StatsPopUp';
import { RefreshNotification } from '@/components/RefreshNotification';
import { Toaster } from '@/components/ui/sonner';

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
  // Pathless layout — never the active leaf; its children declare their own flag.
  staticData: { legalDisclaimer: false },
  component: () => (
    <>
      <Suspense fallback={null}>
        <MapView />
      </Suspense>
      <StationSearch />
      <StatsPopUp />
      <RefreshNotification />
      <SettingsButton />
      <LayerToggleButton />
      <ReportsOverviewButton />
      <ReportButton />
      <Outlet />
      {/* Scoped to the map layout so toasts only fire/show here, never on /reports etc. */}
      <Toaster />
    </>
  ),
});
