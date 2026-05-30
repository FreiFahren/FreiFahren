import { createContext, useContext } from 'react';

export type GeolocationStatus = 'idle' | 'loading' | 'tracking' | 'denied' | 'unavailable';

export type UserPosition = { lng: number; lat: number };

export type GeolocationContextValue = {
  status: GeolocationStatus;
  position: UserPosition | null;
  accuracy: number | null; // metres, from GeolocationCoordinates.accuracy

  // Internal setters, driven by the map's GeolocateControl events.
  notifyLoading: () => void;
  notifyPosition: (coords: GeolocationCoordinates) => void;
  notifyError: (code: number) => void; // GeolocationPositionError.code
};

export const GeolocationContext = createContext<GeolocationContextValue | null>(null);

export function useGeolocation(): GeolocationContextValue {
  const ctx = useContext(GeolocationContext);
  if (!ctx) throw new Error('useGeolocation must be used within GeolocationProvider');
  return ctx;
}
