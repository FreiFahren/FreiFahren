import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';

import { AppBanner } from '@/components/AppBanner';
import { AppRemovalBanner } from '@/components/AppRemovalBanner';
import { ConsentBanner } from '@/components/ConsentBanner';
import { ContributeCard } from '@/components/contribute/ContributeCard';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';
import { LegalDisclaimer } from '@/components/LegalDisclaimer';
import { CityLocationPrompt } from '@/components/map/city-location-prompt';
import { PersistentMapView } from '@/components/map/PersistentMapView';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { PwaUpdatePrompt } from '@/components/pwa-update-prompt';
import { ScreenshotBranding } from '@/components/ScreenshotBranding';
import { GeolocationProvider } from '@/contexts/GeolocationProvider';
import { ReportSimulationProvider } from '@/contexts/ReportSimulationProvider';
import { notifyNativeAppReady } from '@/lib/native';

function NativeAppReady() {
  const onMapRoute = useRouterState({
    select: (state) => state.matches.some((match) => match.routeId.startsWith('/_map')),
  });

  useEffect(() => {
    if (!onMapRoute) void notifyNativeAppReady();
  }, [onMapRoute]);

  return null;
}

export const Route = createRootRoute({
  // Root is never the active leaf, so the disclaimer never reads this value;
  // the flag is required on every route regardless of whether it is consulted.
  staticData: { legalDisclaimer: false },
  component: () => (
    <GeolocationProvider>
      <ReportSimulationProvider>
        <NativeAppReady />
        <PersistentMapView />
        <AppBanner />
        <AppRemovalBanner />
        <Outlet />
        <Onboarding />
        <LegalDisclaimer />
        <CityLocationPrompt />
        <PwaUpdatePrompt />
        <ContributeCard />
        <FeedbackCard />
        <ConsentBanner />
        <ScreenshotBranding />
      </ReportSimulationProvider>
    </GeolocationProvider>
  ),
});
