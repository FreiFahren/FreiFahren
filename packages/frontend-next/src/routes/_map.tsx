import { createFileRoute, Outlet } from '@tanstack/react-router';

import { MapView } from '@/components/map/Map';
import { ReportButton } from '@/components/map/ReportButton';
import { StationSearch } from '@/components/map/StationSearch';

export const Route = createFileRoute('/_map')({
  component: () => (
    <>
      <MapView />
      <StationSearch />
      <ReportButton />
      <Outlet />
    </>
  ),
});
