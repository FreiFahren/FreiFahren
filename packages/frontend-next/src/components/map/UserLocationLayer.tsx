import { Layer, Source } from 'react-map-gl/maplibre';

import { useGeolocation } from '@/contexts/Geolocation.context';

// MapLibre's own user-location colours, so the dot looks identical to GeolocateControl's.
const DOT_COLOR = '#1da1f2';
const DOT_RADIUS = 7.5;
const DOT_STROKE_WIDTH = 2;
const ACCURACY_OPACITY = 0.2;

// Metres per pixel at zoom 0 on the equator. Expressions can't compute cos(lat), so we fold the
// latitude term into a zoom-0 pixel radius and let an exponential-base-2 zoom interpolation scale it.
const METERS_PER_PIXEL_Z0 = 156_543.03392;

function accuracyPixelsAtZoom0(accuracyMeters: number, lat: number): number {
  return accuracyMeters / (METERS_PER_PIXEL_Z0 * Math.cos((lat * Math.PI) / 180));
}

/**
 * Renders the user-location dot and accuracy circle as a GeoJSON circle layer from the watched
 * position. Replaces maplibre's GeolocateControl (see UserLocationControl).
 */
export function UserLocationLayer() {
  const { position, accuracy } = useGeolocation();

  if (!position) return null;

  const data = {
    type: 'FeatureCollection' as const,
    features: [
      {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [position.lng, position.lat] },
        properties: {},
      },
    ],
  };

  const r0 = accuracy != null ? accuracyPixelsAtZoom0(accuracy, position.lat) : 0;

  return (
    <Source id="user-location" type="geojson" data={data}>
      {accuracy != null && (
        <Layer
          id="user-location-accuracy"
          type="circle"
          paint={{
            'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, r0, 24, r0 * 2 ** 24],
            'circle-color': DOT_COLOR,
            'circle-opacity': ACCURACY_OPACITY,
          }}
        />
      )}
      <Layer
        id="user-location-dot"
        type="circle"
        paint={{
          'circle-radius': DOT_RADIUS,
          'circle-color': DOT_COLOR,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': DOT_STROKE_WIDTH,
        }}
      />
    </Source>
  );
}
