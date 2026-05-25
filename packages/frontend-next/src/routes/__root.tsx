import { createRootRoute, Outlet } from '@tanstack/react-router';

import { MapView } from '@/components/map/Map';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <MapView />
      <Outlet />
    </>
  );
}
