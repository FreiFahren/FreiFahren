import { Capacitor } from '@capacitor/core';
import { type ReactNode, useRef, useState } from 'react';

import { type LocationRequestTrigger, track } from '@/lib/analytics';
import {
  forgetLocationSuccess,
  rememberLocationSuccess,
  requestGeolocationPermission,
} from '@/lib/location-prompt';

import {
  GeolocationContext,
  type GeolocationContextValue,
  type GeolocationCoords,
  type GeolocationStatus,
  type UserPosition,
} from './Geolocation.context';

function geolocationFailureReason(code: number) {
  if (code === 1) return 'denied';
  if (code === 3) return 'timeout';
  return 'unavailable';
}

const REFINE_TIMEOUT_MS = 8_000;

export function GeolocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const requestRef = useRef<Promise<GeolocationCoords | null> | null>(null);
  const refineRef = useRef<Promise<GeolocationCoords | null> | null>(null);

  const notifyLoading = () => setStatus('loading');

  const notifyPosition = (coords: GeolocationCoords) => {
    rememberLocationSuccess();
    setPosition({ lng: coords.longitude, lat: coords.latitude });
    setAccuracy(coords.accuracy);
    setStatus('tracking');
  };

  const notifyError = (code: number) => {
    // GeolocationPositionError: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
    if (code === 1) forgetLocationSuccess();
    setStatus(code === 1 ? 'denied' : 'unavailable');
  };

  const requestLocation = (trigger: LocationRequestTrigger): Promise<GeolocationCoords | null> => {
    if (requestRef.current) return requestRef.current;

    const request = async () => {
      track('location_request_started', { trigger });
      notifyLoading();

      try {
        let coords: GeolocationCoords;
        if (Capacitor.isNativePlatform()) {
          if (trigger !== 'auto') {
            const permission = await requestGeolocationPermission();
            if (permission === 'denied') {
              notifyError(1);
              track('location_failed', { trigger, reason: 'denied' });
              return null;
            }
          }
          const { Geolocation } = await import('@capacitor/geolocation');
          coords = (
            await Geolocation.getCurrentPosition({
              enableHighAccuracy: false,
              timeout: 20_000,
              maximumAge: 60_000,
            })
          ).coords;
        } else {
          if (!navigator.geolocation)
            throw Object.assign(new Error('Geolocation unavailable'), { code: 2 });
          coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              (position) => resolve(position.coords),
              reject,
              {
                enableHighAccuracy: false,
                timeout: 20_000,
                maximumAge: 60_000,
              },
            );
          });
        }

        notifyPosition(coords);
        track('location_acquired', { trigger });
        return coords;
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error ? Number(error.code) : 2;
        notifyError(code);
        track('location_failed', {
          trigger,
          reason: geolocationFailureReason(code),
        });
        return null;
      } finally {
        requestRef.current = null;
      }
    };

    requestRef.current = request();
    return requestRef.current;
  };

  /*
   * Deliberately bypasses `notifyLoading`: the map watch tears down on any tracking → loading hop,
   * and a refinement that fails must not downgrade a position we already have.
   */
  const refineLocation = (): Promise<GeolocationCoords | null> => {
    if (refineRef.current) return refineRef.current;

    const options = { enableHighAccuracy: true, timeout: REFINE_TIMEOUT_MS, maximumAge: 0 };
    const refine = async () => {
      try {
        let coords: GeolocationCoords;
        if (Capacitor.isNativePlatform()) {
          const { Geolocation } = await import('@capacitor/geolocation');
          coords = (await Geolocation.getCurrentPosition(options)).coords;
        } else {
          if (!navigator.geolocation) return null;
          coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition((p) => resolve(p.coords), reject, options);
          });
        }
        notifyPosition(coords);
        return coords;
      } catch {
        return null;
      } finally {
        refineRef.current = null;
      }
    };

    refineRef.current = refine();
    return refineRef.current;
  };

  const value: GeolocationContextValue = {
    status,
    position,
    accuracy,
    requestLocation,
    refineLocation,
    notifyLoading,
    notifyPosition,
    notifyError,
  };

  return <GeolocationContext value={value}>{children}</GeolocationContext>;
}
