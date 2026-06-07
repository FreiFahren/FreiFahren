import { createFileRoute, Outlet } from '@tanstack/react-router';

import { LayerToggleButton } from '@/components/map/LayerToggleButton';
import { ReportButton } from '@/components/map/ReportButton';
import { ReportsOverviewButton } from '@/components/map/ReportsOverviewButton';
import { SettingsButton } from '@/components/map/SettingsButton';
import { StationSearch } from '@/components/map/StationSearch';
import { StatsPopUp } from '@/components/map/StatsPopUp';
import { RefreshNotification } from '@/components/RefreshNotification';
import { Toaster } from '@/components/ui/sonner';

export const Route = createFileRoute('/_map')({
  // Pathless layout — never the active leaf; its children declare their own flag.
  // The map instance lives at the app shell (PersistentMapView in __root); this layout
  // only holds the on-map controls and modals.
  staticData: { legalDisclaimer: false },
  component: () => (
    <>
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
