import { Layer, Source } from 'react-map-gl/maplibre';

import { type Station, stationsToGeoJSON, useStations } from '@/api/transit';

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
        id="stations-circle"
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
