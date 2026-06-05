import { createRootRoute, Outlet } from '@tanstack/react-router';

import { ContributeCard } from '@/components/contribute/ContributeCard';
import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { GeolocationProvider } from '@/contexts/GeolocationProvider';

export const Route = createRootRoute({
  // Root is never the active leaf, so the disclaimer never reads this value;
  // the flag is required on every route regardless of whether it is consulted.
  staticData: { legalDisclaimer: false },
  component: () => (
    <GeolocationProvider>
      <Outlet />
      <LegalDisclaimer />
      <ContributeCard />
    </GeolocationProvider>
  ),
});
