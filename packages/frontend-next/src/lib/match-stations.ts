import type { Station } from '@/api/transit';

/** Cap on rendered results: the list sits over the map and must not cover it. */
export const MAX_STATION_RESULTS = 8;

/**
 * Substring match on the station name, case- and whitespace-insensitive, capped at
 * MAX_STATION_RESULTS. Order follows the input, so callers decide what "first" means.
 */
export function matchStations(stations: Station[], query: string): Station[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const results: Station[] = [];
  for (const station of stations) {
    if (station.name.toLowerCase().includes(needle)) {
      results.push(station);
      if (results.length === MAX_STATION_RESULTS) break;
    }
  }
  return results;
}
