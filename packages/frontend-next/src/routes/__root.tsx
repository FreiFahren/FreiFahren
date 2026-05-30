import { createRootRoute, Outlet } from '@tanstack/react-router';

import { GeolocationProvider } from '@/contexts/GeolocationProvider';

export const Route = createRootRoute({
  component: () => (
    <GeolocationProvider>
      <Outlet />
    </GeolocationProvider>
  ),
});
