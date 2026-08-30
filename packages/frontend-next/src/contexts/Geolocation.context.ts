import { createContext, useContext } from 'react';

import type { LocationRequestTrigger } from '@/lib/analytics';

export type GeolocationStatus = 'idle' | 'loading' | 'tracking' | 'denied' | 'unavailable';

export type UserPosition = { lng: number; lat: number };

// The subset of GeolocationCoordinates we consume — satisfied by both the DOM type and the
// Capacitor plugin's coords (which lacks toJSON).
export type GeolocationCoords = Pick<GeolocationCoordinates, 'longitude' | 'latitude' | 'accuracy'>;

export type GeolocationContextValue = {
  status: GeolocationStatus;
  position: UserPosition | null;
  accuracy: number | null; // metres, from GeolocationCoordinates.accuracy

  requestLocation: (trigger: LocationRequestTrigger) => Promise<GeolocationCoords | null>;

  // Internal setters, driven by the shared request and the live map watch.
  notifyLoading: () => void;
  notifyPosition: (coords: GeolocationCoords) => void;
  notifyError: (code: number) => void; // GeolocationPositionError.code
};

export const GeolocationContext = createContext<GeolocationContextValue | null>(null);

export function useGeolocation(): GeolocationContextValue {
  const ctx = useContext(GeolocationContext);
  if (!ctx) throw new Error('useGeolocation must be used within GeolocationProvider');
  return ctx;
}
