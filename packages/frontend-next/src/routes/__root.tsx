import { createRootRoute, Outlet } from '@tanstack/react-router';

import { MapView } from '@/components/map/Map';
import { StationSearch } from '@/components/map/StationSearch';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <MapView />
      <StationSearch />
      <Outlet />
    </>
  );
}
