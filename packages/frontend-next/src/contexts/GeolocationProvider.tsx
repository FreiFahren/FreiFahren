import { type ReactNode, useEffect, useState } from 'react';

import {
  GeolocationContext,
  type GeolocationContextValue,
  type GeolocationStatus,
  type UserPosition,
} from './Geolocation.context';

/**
 * Single source of truth for the user's geolocation.
 *
 * Watches navigator.geolocation directly rather than maplibre's GeolocateControl, which
 * always recenters/zooms the camera on its first fix. Acquiring the position here keeps it
 * decoupled from the map viewport: the map reads this state to draw the user's location in
 * place, and never moves the camera in response to location updates (see FRE-627).
 */
export function GeolocationProvider({ children }: { children: ReactNode }) {
  // Derive the starting status during render so the effect only ever calls setState from
  // its async geolocation callbacks (the React Compiler lint rule forbids synchronous
  // setState inside an effect body).
  const [status, setStatus] = useState<GeolocationStatus>(() =>
    typeof navigator !== 'undefined' && navigator.geolocation ? 'loading' : 'unavailable',
  );
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setPosition({ lng: coords.longitude, lat: coords.latitude });
        setAccuracy(coords.accuracy);
        setStatus('tracking');
      },
      (error) => {
        // GeolocationPositionError: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
        setStatus(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const value: GeolocationContextValue = { status, position, accuracy };

  return <GeolocationContext value={value}>{children}</GeolocationContext>;
}
