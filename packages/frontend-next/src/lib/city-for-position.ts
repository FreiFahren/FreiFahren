import type { PublicCityConfig } from '@freifahren/cities/public';

function pointInBounds(lng: number, lat: number, city: PublicCityConfig): boolean {
  const [west, south, east, north] = city.map.bounds;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

function distanceToCenter(lng: number, lat: number, city: PublicCityConfig): number {
  const [centerLng, centerLat] = city.map.center;
  const dLng = lng - centerLng;
  const dLat = lat - centerLat;
  return dLng * dLng + dLat * dLat;
}

export function cityForPosition(
  lng: number,
  lat: number,
  cities: readonly PublicCityConfig[],
): PublicCityConfig | null {
  const matches = cities.filter((city) => pointInBounds(lng, lat, city));
  if (matches.length === 0) return null;
  return matches.reduce((closest, city) =>
    distanceToCenter(lng, lat, city) < distanceToCenter(lng, lat, closest) ? city : closest,
  );
}
