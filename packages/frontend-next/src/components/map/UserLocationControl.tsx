import { useRouterState } from '@tanstack/react-router';
import type { GeolocateControl as GeolocateControlInstance } from 'maplibre-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GeolocateControl, useMap } from 'react-map-gl/maplibre';

import { useGeolocation } from '@/contexts/Geolocation.context';
import { type LocationRequestTrigger, track } from '@/lib/analytics';
import { useContributeModalOpen } from '@/lib/contribute-modal';
import { useLegalDisclaimer } from '@/lib/legal-disclaimer';
import {
  dismissLocationPrompt,
  isLocationPromptDismissed,
  LOCATION_PROMPT_DELAY_MS,
  queryGeolocationPermission,
} from '@/lib/location-prompt';

import { LocationPermissionPrompt } from './LocationPermissionPrompt';

// GeolocationPositionError codes (1/2/3). 'denied' after a soft-ask Allow is the key browser-quirk
// signal: the user consented in-app but the native prompt (or OS-level setting) blocked us.
const failureReason = (code: number) =>
  code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable';

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
  // The soft-ask is the lowest-priority card: it must never overlap another card. Sub-route panels
  // are already excluded by `onMapIndex`; the contribute card is the one card that can open over the
  // map index (e.g. after a report submit), so yield to it and resurface once it closes.
  const contributeOpen = useContributeModalOpen();
  // Funnel tracking state. GeolocateControl keeps tracking after the first fix (onGeolocate fires
  // on every update, onError can repeat), so report acquired/failed once per request.
  const requestRef = useRef<{ trigger: LocationRequestTrigger } | null>(null);
  const outcomeReportedRef = useRef(false);
  const permissionTrackedRef = useRef(false);
  const promptShownTrackedRef = useRef(false);

  const trigger = useCallback(
    (requestTrigger: LocationRequestTrigger) => {
      const control = controlRef.current;
      // Suppress GeolocateControl recentering/zooming the camera on the first fix; we only want the dot.
      if (control) {
        (control as unknown as { _updateCamera: () => void })._updateCamera = () => {};
      }
      track('location_request_started', { trigger: requestTrigger });
      requestRef.current = { trigger: requestTrigger };
      outcomeReportedRef.current = false;
      notifyLoading();
      control?.trigger();
    },
    [notifyLoading],
  );

  // Gate on disclaimer acceptance + map load. Only 'granted' tracks immediately (the API call is
  // silent then); for 'prompt'/'unsupported' we must not call the API ourselves — on Safari/iOS
  // that would surface the native prompt — so we show the deferred soft-ask and only trigger on
  // the user's explicit Allow.
  useEffect(() => {
    if (!map || !accepted) return;

    let cancelled = false;
    let timer = 0;

    const evaluate = async () => {
      const permission = await queryGeolocationPermission();
      if (cancelled) return;

      // Funnel entry: the pre-existing permission state, where browsers diverge the most (older
      // Safari has no Permissions API → 'unsupported', "Allow once" doesn't persist, etc.).
      // Once per session — the effect can re-run on dependency changes.
      if (!permissionTrackedRef.current) {
        permissionTrackedRef.current = true;
        track('location_permission_evaluated', { state: permission });
      }

      if (permission === 'granted') {
        trigger('auto');
        return;
      }
      if (permission === 'denied') return;

      if (isLocationPromptDismissed()) return;
      timer = window.setTimeout(() => {
        if (!cancelled && !isLocationPromptDismissed()) setShowPrompt(true);
      }, LOCATION_PROMPT_DELAY_MS);
    };

    // Mounts only after the base map's `load` (gated by MapView), so don't wait on that one-shot
    // event — it has already fired and won't fire again. Evaluate now.
    void evaluate();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [map, accepted, trigger]);

  const handleAllow = () => {
    track('location_prompt_allowed', {});
    setShowPrompt(false);
    trigger('soft_prompt');
  };

  const handleDismiss = () => {
    track('location_prompt_dismissed', {});
    setShowPrompt(false);
    dismissLocationPrompt();
  };

  const handleGeolocate = (coords: GeolocationCoordinates) => {
    notifyPosition(coords);
    const request = requestRef.current;
    if (request && !outcomeReportedRef.current) {
      outcomeReportedRef.current = true;
      track('location_acquired', { trigger: request.trigger });
    }
  };

  const handleError = (code: number) => {
    notifyError(code);
    const request = requestRef.current;
    if (request && !outcomeReportedRef.current) {
      outcomeReportedRef.current = true;
      track('location_failed', { trigger: request.trigger, reason: failureReason(code) });
    }
  };

  // The card is conditionally rendered below; count it as "shown" only when it is actually visible,
  // not when the timer merely arms it while a sub-route panel or the contribute card covers the map.
  const promptVisible = showPrompt && onMapIndex && !contributeOpen;
  useEffect(() => {
    if (promptVisible && !promptShownTrackedRef.current) {
      promptShownTrackedRef.current = true;
      track('location_prompt_shown', {});
    }
  }, [promptVisible]);

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
        onGeolocate={(e) => handleGeolocate(e.coords)}
        onError={(e) => handleError(e.code)}
        onTrackUserLocationStart={() => notifyLoading()}
      />
      {promptVisible && <LocationPermissionPrompt onAllow={handleAllow} onDismiss={handleDismiss} />}
    </>
  );
}
