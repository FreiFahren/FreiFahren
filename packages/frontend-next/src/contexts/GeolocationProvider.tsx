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
  type GeolocationFix,
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
  const [timestamp, setTimestamp] = useState<number | null>(null);

  const requestRef = useRef<Promise<GeolocationFix | null> | null>(null);
  const refineRef = useRef<Promise<GeolocationFix | null> | null>(null);

  const notifyLoading = () => setStatus('loading');

  const notifyPosition = (coords: GeolocationCoords, timestamp: number) => {
    setTimestamp(timestamp);
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

  const requestLocation = (trigger: LocationRequestTrigger): Promise<GeolocationFix | null> => {
    if (requestRef.current) return requestRef.current;

    const request = async () => {
      track('location_request_started', { trigger });
      notifyLoading();

      try {
        let fix: GeolocationFix;
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
          fix = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 20_000,
            maximumAge: 60_000,
          });
        } else {
          if (!navigator.geolocation)
            throw Object.assign(new Error('Geolocation unavailable'), { code: 2 });
          fix = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition((position) => resolve(position), reject, {
              enableHighAccuracy: false,
              timeout: 20_000,
              maximumAge: 60_000,
            });
          });
        }

        notifyPosition(fix.coords, fix.timestamp);
        track('location_acquired', { trigger });
        return fix;
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
  const refineLocation = (): Promise<GeolocationFix | null> => {
    if (refineRef.current) return refineRef.current;

    const options = { enableHighAccuracy: true, timeout: REFINE_TIMEOUT_MS, maximumAge: 0 };
    const refine = async () => {
      try {
        let fix: GeolocationFix;
        if (Capacitor.isNativePlatform()) {
          const { Geolocation } = await import('@capacitor/geolocation');
          fix = await Geolocation.getCurrentPosition(options);
        } else {
          if (!navigator.geolocation) return null;
          fix = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition((p) => resolve(p), reject, options);
          });
        }
        notifyPosition(fix.coords, fix.timestamp);
        return fix;
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
    timestamp,
    requestLocation,
    refineLocation,
    notifyLoading,
    notifyPosition,
    notifyError,
  };

  return <GeolocationContext value={value}>{children}</GeolocationContext>;
}
