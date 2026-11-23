import { createContext, useContext } from 'react';

import type { LocationRequestTrigger } from '@/lib/analytics';

export type GeolocationStatus = 'idle' | 'loading' | 'tracking' | 'denied' | 'unavailable';

export type UserPosition = { lng: number; lat: number };

// The subset of GeolocationCoordinates we consume — satisfied by both the DOM type and the
// Capacitor plugin's coords (which lacks toJSON).
export type GeolocationCoords = Pick<GeolocationCoordinates, 'longitude' | 'latitude' | 'accuracy'>;

export type GeolocationFix = { coords: GeolocationCoords; timestamp: number };

export type GeolocationContextValue = {
  status: GeolocationStatus;
  position: UserPosition | null;
  accuracy: number | null; // metres, from GeolocationCoordinates.accuracy
  timestamp: number | null; // Device fix time, not the time we received it.

  requestLocation: (trigger: LocationRequestTrigger) => Promise<GeolocationFix | null>;
  // One fresh high-accuracy fix on top of an existing one. A failure changes nothing, so the coarse
  // fix stays in place; a success lands like any other position update.
  refineLocation: () => Promise<GeolocationFix | null>;

  // Internal setters, driven by the shared request and the live map watch.
  notifyLoading: () => void;
  notifyPosition: (coords: GeolocationCoords, timestamp: number) => void;
  notifyError: (code: number) => void; // GeolocationPositionError.code
};

export const GeolocationContext = createContext<GeolocationContextValue | null>(null);

export function useGeolocation(): GeolocationContextValue {
  const ctx = useContext(GeolocationContext);
  if (!ctx) throw new Error('useGeolocation must be used within GeolocationProvider');
  return ctx;
}
