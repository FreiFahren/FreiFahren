import { Layer, Marker, Source } from 'react-map-gl/maplibre';

import { type UserPosition, useGeolocation } from '@/contexts/Geolocation.context';

const ACCURACY_FILL_LAYER_ID = 'user-location-accuracy';
const USER_LOCATION_COLOR = '#2563eb'; // Tailwind blue-600

// Build a geographic circle (radius in metres) as a GeoJSON polygon so the accuracy ring
// scales with the map like a real-world area instead of a fixed pixel size.
function accuracyCircle(center: UserPosition, radiusMeters: number, steps = 64) {
  const coordinates: [number, number][] = [];
  const earthRadius = 6_378_137; // WGS84 equatorial radius in metres
  const latRad = (center.lat * Math.PI) / 180;

  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = ((radiusMeters * Math.sin(angle)) / earthRadius) * (180 / Math.PI);
    const dLng =
      ((radiusMeters * Math.cos(angle)) / (earthRadius * Math.cos(latRad))) * (180 / Math.PI);
    coordinates.push([center.lng + dLng, center.lat + dLat]);
  }

  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
  };
}

/**
 * Renders the user's location (blue dot + accuracy circle) from GeolocationProvider.
 *
 * It deliberately never moves the camera: granting or updating location shows the position
 * in place without zooming or recentering, so the user keeps control of their viewport
 * (see FRE-627). Position data comes from navigator.geolocation via the provider, not from
 * maplibre's GeolocateControl, which always recenters on its first fix.
 */
export function UserLocationLayer() {
  const { position, accuracy } = useGeolocation();

  if (!position) return null;

  return (
    <>
      {accuracy != null && accuracy > 0 && (
        <Source
          id="user-location-accuracy"
          type="geojson"
          data={accuracyCircle(position, accuracy)}
        >
          <Layer
            id={ACCURACY_FILL_LAYER_ID}
            type="fill"
            paint={{ 'fill-color': USER_LOCATION_COLOR, 'fill-opacity': 0.12 }}
          />
        </Source>
      )}
      <Marker longitude={position.lng} latitude={position.lat}>
        <span
          className="block h-4 w-4 rounded-full border-2 border-white shadow-md"
          style={{ backgroundColor: USER_LOCATION_COLOR }}
        />
      </Marker>
    </>
  );
}
