import { createRootRoute, Outlet } from '@tanstack/react-router';

import { RefreshNotification } from '@/components/RefreshNotification';
import { Toaster } from '@/components/ui/sonner';
import { GeolocationProvider } from '@/contexts/GeolocationProvider';

export const Route = createRootRoute({
  component: () => (
    <GeolocationProvider>
      <Outlet />
      <RefreshNotification />
      <Toaster />
    </GeolocationProvider>
  ),
});
