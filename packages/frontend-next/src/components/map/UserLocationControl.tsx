import { useCallback, useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { type GeolocationCoords, useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import { useOnboardingComplete } from '@/lib/onboarding';
import {
  LOCATION_PROMPT_DELAY_MS,
  queryGeolocationPermission,
  requestGeolocationPermission,
} from '@/lib/location-prompt';

import { UserLocationLayer } from './UserLocationLayer';

// GeolocationPositionError codes (1/2/3).
const failureReason = (code: number) =>
  code === 1 ? 'denied' : code === 3 ? 'timeout' : 'unavailable';

// Optimised for phones (GPS): high accuracy on every platform. Desktop browsers without GPS may
// fail to get a fix, but they aren't the target.
const WATCH_OPTIONS = { enableHighAccuracy: true };

/**
 * Sources location solely from the Capacitor Geolocation plugin (CoreLocation on native,
 * navigator.geolocation on web) and renders the dot via UserLocationLayer — one native prompt, no
 * extra WebKit per-site prompt on iOS. Requested once: at once if granted, else after a delay.
 */
export function UserLocationControl() {
  const { current: map } = useMap();
  const { notifyLoading, notifyPosition, notifyError } = useGeolocation();
  const onboarded = useOnboardingComplete();
  // The watch callback repeats; report acquired/failed only once.
  const outcomeReportedRef = useRef(false);
  const watchIdRef = useRef<string | null>(null);
  // The gate effect can re-run; evaluate once.
  const evaluatedRef = useRef(false);

  const handleGeolocate = useCallback(
    (coords: GeolocationCoords) => {
      notifyPosition(coords);
      if (!outcomeReportedRef.current) {
        outcomeReportedRef.current = true;
        track('location_acquired', { trigger: 'auto' });
      }
    },
    [notifyPosition],
  );

  const handleError = useCallback(
    (code: number) => {
      notifyError(code);
      if (!outcomeReportedRef.current) {
        outcomeReportedRef.current = true;
        track('location_failed', { trigger: 'auto', reason: failureReason(code) });
      }
    },
    [notifyError],
  );

  const startWatch = useCallback(async () => {
    track('location_request_started', { trigger: 'auto' });
    outcomeReportedRef.current = false;
    notifyLoading();
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      if (watchIdRef.current) await Geolocation.clearWatch({ id: watchIdRef.current });
      watchIdRef.current = await Geolocation.watchPosition(WATCH_OPTIONS, (position, err) => {
        if (err) {
          // Native plugin errors have no code; fall back to POSITION_UNAVAILABLE.
          handleError(typeof err.code === 'number' ? err.code : 2);
          return;
        }
        if (position) handleGeolocate(position.coords);
      });
    } catch {
      handleError(2);
    }
  }, [notifyLoading, handleError, handleGeolocate]);

  // Gate on onboarding completion and map load. Granted → watch at once; otherwise wait, then
  // surface the native prompt (requestPermissions on native; the watch itself prompts on web).
  useEffect(() => {
    if (!map || !onboarded) return;

    let cancelled = false;
    let timer = 0;

    const evaluate = async () => {
      const permission = await queryGeolocationPermission();
      if (cancelled || evaluatedRef.current) return;
      evaluatedRef.current = true;

      track('location_permission_evaluated', { state: permission });

      if (permission === 'granted') {
        void startWatch();
        return;
      }
      if (permission === 'denied') return;

      timer = window.setTimeout(async () => {
        if (cancelled) return;
        const requested = await requestGeolocationPermission();
        if (cancelled) return;
        if (requested === 'denied') {
          handleError(1);
          return;
        }
        void startWatch();
      }, LOCATION_PROMPT_DELAY_MS);
    };

    // Mounts after the base map's `load` (gated by MapView), so that one-shot event has fired already.
    void evaluate();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [map, onboarded, startWatch, handleError]);

  // Release the location sensor on unmount.
  useEffect(
    () => () => {
      const id = watchIdRef.current;
      if (id) {
        watchIdRef.current = null;
        void import('@capacitor/geolocation').then(({ Geolocation }) =>
          Geolocation.clearWatch({ id }),
        );
      }
    },
    [],
  );

  return <UserLocationLayer />;
}
