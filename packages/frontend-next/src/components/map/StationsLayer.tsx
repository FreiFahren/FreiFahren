import { Layer, Source } from 'react-map-gl/maplibre';

import { type Station, stationsToGeoJSON, useStations } from '@/api/transit';

// Bottom-most (visible) station layer. Line layers insert `beforeId` this so they always render
// beneath the station dots, regardless of mount order when toggling between line/risk layers.
export const STATIONS_BASE_LAYER_ID = 'stations-circle';
export const STATIONS_LAYER_ID = 'stations-hit';

type StationsLayerProps = {
  selectedStation: Station | undefined;
};

export function StationsLayer({ selectedStation }: StationsLayerProps) {
  const { data: stations } = useStations();

  if (!stations) return null;

  return (
    <Source id="stations" type="geojson" data={stationsToGeoJSON(stations)}>
      <Layer
        id={STATIONS_BASE_LAYER_ID}
        type="circle"
        paint={{
          'circle-radius': ['case', ['==', ['get', 'id'], selectedStation?.id ?? ''], 5, 2],
          'circle-color': '#ffffff',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 1,
        }}
      />
      <Layer
        id={STATIONS_LAYER_ID}
        type="circle"
        paint={{
          'circle-radius': 12,
          'circle-color': '#000000',
          'circle-opacity': 0,
        }}
      />
    </Source>
  );
}
