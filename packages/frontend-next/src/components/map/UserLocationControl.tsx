import { useRouterState } from '@tanstack/react-router';
import type { GeolocateControl as GeolocateControlInstance } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GeolocateControl, useMap } from 'react-map-gl/maplibre';

import { useGeolocation } from '@/contexts/Geolocation.context';
import { useLegalDisclaimer } from '@/lib/legal-disclaimer';
import {
  dismissLocationPrompt,
  hasConsentedToLocation,
  isLocationPromptDismissed,
  LOCATION_PROMPT_DELAY_MS,
  markLocationConsented,
  queryGeolocationPermission,
} from '@/lib/location-prompt';

import { LocationPermissionPrompt } from './LocationPermissionPrompt';

/**
 * Renders maplibre's GeolocateControl (location dot, accuracy circle, tracking) and mirrors its
 * events into GeolocationProvider. Location is not requested eagerly — it is gated and delayed;
 * see `@/lib/location-prompt`.
 */
export function UserLocationControl() {
  const { current: map } = useMap();
  const controlRef = useRef<GeolocateControlInstance>(null);
  const { notifyLoading, notifyPosition, notifyError } = useGeolocation();
  const { accepted } = useLegalDisclaimer();
  const [showPrompt, setShowPrompt] = useState(false);
  // Soft-ask only on the bare map, never over a sub-route's panel.
  const onMapIndex = useRouterState({ select: (s) => s.location.pathname === '/' });

  const trigger = useCallback(() => {
    const control = controlRef.current;
    // Suppress GeolocateControl recentering/zooming the camera on the first fix; we only want the dot.
    if (control) {
      (control as unknown as { _updateCamera: () => void })._updateCamera = () => {};
    }
    notifyLoading();
    control?.trigger();
  }, [notifyLoading]);

  // Gate on disclaimer acceptance + map load. 'granted' tracks silently. A returning user who
  // already accepted our soft-ask is also triggered directly: iOS scopes the grant to the session
  // and keeps reporting 'prompt', so we rely on stored consent rather than re-nagging — the browser
  // re-confirms natively if its session grant has lapsed. First-time 'prompt'/'unsupported' users
  // get the deferred soft-ask; we never call the API ourselves before that.
  useEffect(() => {
    if (!map || !accepted) return;

    let cancelled = false;
    let timer = 0;

    const evaluate = async () => {
      const permission = await queryGeolocationPermission();
      if (cancelled) return;

      if (permission === 'denied') return;
      if (permission === 'granted' || hasConsentedToLocation()) {
        trigger();
        return;
      }

      if (isLocationPromptDismissed()) return;
      timer = window.setTimeout(() => {
        if (!cancelled && !isLocationPromptDismissed()) setShowPrompt(true);
      }, LOCATION_PROMPT_DELAY_MS);
    };

    const start = () => void evaluate();
    if (map.loaded()) start();
    else map.once('load', start);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      map.off('load', start);
    };
  }, [map, accepted, trigger]);

  const handleAllow = () => {
    setShowPrompt(false);
    markLocationConsented();
    trigger();
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    dismissLocationPrompt();
  };

  return (
    <>
      <GeolocateControl
        ref={controlRef}
        // Requested programmatically, so hide the control's button; the dot/accuracy circle stay.
        style={{ display: 'none' }}
        positionOptions={{ enableHighAccuracy: true }}
        trackUserLocation
        showUserLocation
        showAccuracyCircle
        onGeolocate={(e) => notifyPosition(e.coords)}
        onError={(e) => notifyError(e.code)}
        onTrackUserLocationStart={() => notifyLoading()}
      />
      {showPrompt && onMapIndex && (
        <LocationPermissionPrompt onAllow={handleAllow} onDismiss={handleDismiss} />
      )}
    </>
  );
}
