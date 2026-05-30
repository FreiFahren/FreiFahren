import type { GeolocateControl as GeolocateControlInstance } from 'maplibre-gl';
import { useEffect, useRef } from 'react';
import { GeolocateControl, useMap } from 'react-map-gl/maplibre';

import { useGeolocation } from '@/contexts/Geolocation.context';

/**
 * Renders maplibre's native GeolocateControl (blue dot, accuracy circle, continuous
 * tracking, permission/error handling) and mirrors its events into GeolocationProvider
 * so the rest of the app can read the user's position. Tracking is requested
 * automatically once the map has loaded.
 */
export function UserLocationControl() {
  const { current: map } = useMap();
  const controlRef = useRef<GeolocateControlInstance>(null);
  const { notifyLoading, notifyPosition, notifyError } = useGeolocation();

  useEffect(() => {
    if (!map) return;

    // Defer the trigger so StrictMode's dev mount/unmount/mount cycle (which
    // re-adds the control in its inactive state) settles on a single net
    // activation — trigger() toggles, so calling it twice would switch
    // tracking back off.
    let timer = 0;
    const activate = () => {
      timer = window.setTimeout(() => {
        notifyLoading();
        controlRef.current?.trigger();
      }, 0);
    };

    if (map.loaded()) activate();
    else map.once('load', activate);

    return () => {
      window.clearTimeout(timer);
      map.off('load', activate);
    };
  }, [map, notifyLoading]);

  return (
    <GeolocateControl
      ref={controlRef}
      // Location is requested automatically, so the control's button is hidden.
      // This only hides the button container; the user-location dot and accuracy
      // circle are added to the map separately and stay visible.
      style={{ display: 'none' }}
      positionOptions={{ enableHighAccuracy: true }}
      trackUserLocation
      showUserLocation
      showAccuracyCircle
      onGeolocate={(e) => notifyPosition(e.coords)}
      onError={(e) => notifyError(e.code)}
      onTrackUserLocationStart={() => notifyLoading()}
    />
  );
}
