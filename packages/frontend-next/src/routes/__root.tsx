import { createRootRoute, Outlet } from '@tanstack/react-router';

import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { RefreshNotification } from '@/components/RefreshNotification';
import { Toaster } from '@/components/ui/sonner';
import { GeolocationProvider } from '@/contexts/GeolocationProvider';

export const Route = createRootRoute({
  // Root is never the active leaf, so the disclaimer never reads this value;
  // the flag is required on every route regardless of whether it is consulted.
  staticData: { legalDisclaimer: false },
  component: () => (
    <GeolocationProvider>
      <Outlet />
      <RefreshNotification />
      <LegalDisclaimer />
      <Toaster />
    </GeolocationProvider>
  ),
});
