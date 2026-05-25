import { useQuery } from '@tanstack/react-query';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

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

export type LineType = 'subway' | 'suburban' | 'tram' | 'bus' | 'ferry';

export type Line = {
  id: string;
  name: string;
  type: LineType;
  isCircular: boolean;
  stations: StationId[];
};

export type SegmentProperties = {
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

async function fetchJson<T>(path: string): Promise<T> {
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

export const useStations = () =>
  useQuery({
    queryKey: ['transit', 'stations'],
    queryFn: fetchStations,
  });

export const useLines = () =>
  useQuery({
    queryKey: ['transit', 'lines'],
    queryFn: () => fetchJson<Line[]>('/v0/transit/lines'),
  });

export const useSegments = () =>
  useQuery({
    queryKey: ['transit', 'segments'],
    queryFn: () => fetchJson<Segments>('/v0/transit/segments'),
  });
