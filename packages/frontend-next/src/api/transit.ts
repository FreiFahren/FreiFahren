import { useQuery } from '@tanstack/react-query';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import { distanceMeters } from '@/lib/geo';
import { requireEnv } from '@/lib/utils';

const API_URL = requireEnv('VITE_API_URL');

type StationId = string;

type StationResponse = {
  name: string;
  coordinates: { latitude: number; longitude: number };
  lines: string[];
};

export type Station = StationResponse & { id: StationId };
export type Stations = Record<StationId, Station>;

export type LineType = 'subway' | 'light_rail' | 'tram';

// Display ordering for line types (U-Bahn → S-Bahn → Tram).
export const LINE_TYPE_PRIORITY: Record<LineType, number> = {
  subway: 0,
  light_rail: 1,
  tram: 2,
};

// Canonical display order: U-Bahn → S-Bahn → Tram, then ascending within a group (U1 before U9).
export function compareLineOrder(
  a: { name: string; type?: LineType },
  b: { name: string; type?: LineType },
): number {
  if (a.type && b.type && LINE_TYPE_PRIORITY[a.type] !== LINE_TYPE_PRIORITY[b.type]) {
    return LINE_TYPE_PRIORITY[a.type] - LINE_TYPE_PRIORITY[b.type];
  }
  return parseInt(a.name.replace(/\D/g, ''), 10) - parseInt(b.name.replace(/\D/g, ''), 10);
}

export type Line = {
  id: string;
  name: string;
  type: LineType;
  isCircular: boolean;
  color: string;
  stations: StationId[];
};

export type SegmentProperties = {
  id: number;
  line: string;
  from: StationId;
  to: StationId;
  color: string;
};

export type Segment = Feature<LineString, SegmentProperties>;
export type Segments = FeatureCollection<LineString, SegmentProperties>;

export type StationPointProps = { id: string; name: string };

export function stationsToGeoJSON(stations: Stations): FeatureCollection<Point, StationPointProps> {
  return {
    type: 'FeatureCollection',
    features: Object.values(stations).map((station) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [station.coordinates.longitude, station.coordinates.latitude],
      },
      properties: { id: station.id, name: station.name },
    })),
  };
}

export function resolveStationLineNames(
  lineIds: Station['lines'],
  lines: Line[] | undefined,
): string[] {
  const nameById = new Map<string, string>();
  if (lines) for (const line of lines) nameById.set(line.id, line.name);

  const seen = new Set<string>();
  const names: string[] = [];
  for (const id of lineIds) {
    const name = nameById.get(id) ?? id;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed: ${response.status}`);
  }
  return response.json();
}

export async function fetchStations(): Promise<Stations> {
  const response = await fetchJson<Record<StationId, StationResponse>>('/v0/transit/stations');
  const stations: Stations = {};
  for (const [id, station] of Object.entries(response)) stations[id] = { ...station, id };
  return stations;
}

export const stationsQueryOptions = () => ({
  queryKey: ['transit', 'stations'] as const,
  queryFn: fetchStations,
});

export const linesQueryOptions = () => ({
  queryKey: ['transit', 'lines'] as const,
  queryFn: () => fetchJson<Line[]>('/v0/transit/lines'),
});

export const segmentsQueryOptions = () => ({
  queryKey: ['transit', 'segments'] as const,
  queryFn: () => fetchJson<Segments>('/v0/transit/segments'),
});

export const useStations = () => useQuery(stationsQueryOptions());

export const useLines = () => useQuery(linesQueryOptions());

export const useSegments = () => useQuery(segmentsQueryOptions());

function closestStationId(
  stations: Stations,
  position: { lat: number; lng: number },
): string | null {
  let bestId: string | null = null;
  let bestDistance = Infinity;
  for (const station of Object.values(stations)) {
    const d = distanceMeters(
      position.lat,
      position.lng,
      station.coordinates.latitude,
      station.coordinates.longitude,
    );
    if (d < bestDistance) {
      bestDistance = d;
      bestId = station.id;
    }
  }
  return bestId;
}

export const useStationDistance = (
  toStationId: string,
  position: { lat: number; lng: number } | null,
) => {
  const { data: stations } = useStations();
  const fromStationId = position && stations ? closestStationId(stations, position) : null;

  return useQuery({
    queryKey: ['transit', 'distance', fromStationId, toStationId],
    queryFn: () => {
      const params = new URLSearchParams({ from: fromStationId!, to: toStationId });
      return fetchJson<{ distance: number }>(`/v0/transit/distance?${params.toString()}`).then(
        (data) => data.distance,
      );
    },
    enabled: fromStationId !== null && toStationId.length > 0,
  });
};
