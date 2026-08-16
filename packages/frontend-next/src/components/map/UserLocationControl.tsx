import { useRouterState } from '@tanstack/react-router';
import { MapPin } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Capacitor } from '@capacitor/core';
import { useMap } from 'react-map-gl/maplibre';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { useMapLocationSharing, useReportLocationSharing } from '@/hooks/use-location-sharing';
import { useConsentPrompt, useConsentReview } from '@/lib/consent';
import { useContributeModalOpen } from '@/lib/contribute-modal';
import { useOnboardingComplete } from '@/lib/onboarding';
import { optionalEnv } from '@/lib/utils';

import { NAMESPACE } from './location-permission-prompt.i18n';
import { PopupCard } from './PopupCard';
import { UserLocationLayer } from './UserLocationLayer';

const analyticsEnabled = optionalEnv('VITE_POSTHOG_KEY') != null;

type LocationPermissionPromptProps = {
  source: 'map' | 'report';
  inline?: boolean;
  denied?: boolean;
  loading?: boolean;
  onAllow: () => void;
  onDismiss: () => void;
};

function LocationPermissionPrompt({
  source,
  inline = false,
  denied = false,
  loading = false,
  onAllow,
  onDismiss,
}: LocationPermissionPromptProps) {
  const { t } = useTranslation(NAMESPACE);
  const content = (
    <>
      <CardContent className="flex flex-col gap-1">
        {source === 'report' && (
          <p className="text-muted-foreground text-[0.625rem] font-semibold tracking-wide uppercase">
            {t('reportStep')}
          </p>
        )}
        <h2 className="font-heading flex items-center gap-2 text-lg font-semibold">
          <MapPin className="text-accent-bright size-5" />
          {t(denied ? 'deniedTitle' : source === 'map' ? 'mapTitle' : 'reportTitle')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t(
            denied
              ? 'deniedDescription'
              : source === 'map'
                ? 'mapDescription'
                : 'reportDescription',
          )}
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button
          variant={denied ? 'default' : 'outline'}
          className="flex-1"
          disabled={loading}
          onClick={onDismiss}
        >
          {t(source === 'map' ? 'notNow' : 'continueWithout')}
        </Button>
        {!denied && (
          <Button
            className="bg-accent-bright text-primary-foreground hover:bg-accent-press flex-1"
            disabled={loading}
            onClick={onAllow}
          >
            {t('allow')}
          </Button>
        )}
      </CardFooter>
    </>
  );

  if (inline) return <Card className="w-full gap-1 py-4">{content}</Card>;
  return createPortal(<PopupCard>{content}</PopupCard>, document.body);
}

export function ReportLocationStep({ children }: { children: ReactNode }) {
  const sharing = useReportLocationSharing();
  if (sharing.phase === 'complete') return children;
  if (sharing.phase === 'checking') return null;

  return (
    <div className="flex flex-1 items-center px-4">
      <LocationPermissionPrompt
        source="report"
        inline
        denied={sharing.phase === 'denied'}
        loading={sharing.loading}
        onAllow={() => void sharing.allow()}
        onDismiss={sharing.dismiss}
      />
    </div>
  );
}

/**
 * Acquires an already-granted location silently. Otherwise it shows one in-app explanation before
 * the browser or OS prompt, so permission is only requested from a user gesture.
 */
export function UserLocationControl() {
  const { current: map } = useMap();
  const { notifyPosition, status } = useGeolocation();
  const onboarded = useOnboardingComplete();
  const onMapIndex = useRouterState({ select: (state) => state.location.pathname === '/' });
  const contributeOpen = useContributeModalOpen();
  const consentPrompt = useConsentPrompt();
  const consentReview = useConsentReview();
  const consentVisible = analyticsEnabled && (consentPrompt || consentReview);
  const watchIdRef = useRef<string | number | null>(null);
  const notifyPositionRef = useRef(notifyPosition);
  const sharing = useMapLocationSharing({
    enabled: Boolean(map) && onboarded,
    canDisplay: onMapIndex && !contributeOpen && !consentVisible,
  });

  useEffect(() => {
    notifyPositionRef.current = notifyPosition;
  }, [notifyPosition]);

  // Preserve the live map dot after the first successful fix. Starting only after acquisition
  // means this watch can never surface a permission prompt by itself.
  useEffect(() => {
    if (status !== 'tracking' || watchIdRef.current !== null) return;

    let cancelled = false;
    if (Capacitor.isNativePlatform()) {
      void import('@capacitor/geolocation').then(async ({ Geolocation }) => {
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
          (position) => {
            if (!cancelled && position) notifyPositionRef.current(position.coords);
          },
        );
        if (cancelled) void Geolocation.clearWatch({ id });
        else watchIdRef.current = id;
      });
    } else if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => notifyPositionRef.current(position.coords),
        () => {},
        { enableHighAccuracy: false, timeout: 20_000, maximumAge: 60_000 },
      );
    }

    return () => {
      cancelled = true;
      const id = watchIdRef.current;
      watchIdRef.current = null;
      if (id === null) return;
      if (Capacitor.isNativePlatform()) {
        void import('@capacitor/geolocation').then(({ Geolocation }) =>
          Geolocation.clearWatch({ id: String(id) }),
        );
      } else {
        navigator.geolocation.clearWatch(Number(id));
      }
    };
  }, [status]);

  return (
    <>
      <UserLocationLayer />
      {sharing.visible && (
        <LocationPermissionPrompt
          source="map"
          onAllow={sharing.allow}
          onDismiss={sharing.dismiss}
        />
      )}
    </>
  );
}
