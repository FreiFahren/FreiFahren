import { type ReactNode, useCallback, useState } from 'react';

import {
  GeolocationContext,
  type GeolocationContextValue,
  type GeolocationCoords,
  type GeolocationStatus,
  type UserPosition,
} from './Geolocation.context';

export function GeolocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GeolocationStatus>('idle');
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const notifyLoading = useCallback(() => setStatus('loading'), []);

  const notifyPosition = useCallback((coords: GeolocationCoords) => {
    setPosition({ lng: coords.longitude, lat: coords.latitude });
    setAccuracy(coords.accuracy);
    setStatus('tracking');
  }, []);

  const notifyError = useCallback((code: number) => {
    // GeolocationPositionError: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
    setStatus(code === 1 ? 'denied' : 'unavailable');
  }, []);

  const value: GeolocationContextValue = {
    status,
    position,
    accuracy,
    notifyLoading,
    notifyPosition,
    notifyError,
  };

  return <GeolocationContext value={value}>{children}</GeolocationContext>;
}
