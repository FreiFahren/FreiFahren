import { Layer, Source } from 'react-map-gl/maplibre';

import { stationsToGeoJSON, useStations } from '@/api/transit';

export function StationsLayer() {
  const { data: stations } = useStations();

  if (!stations) return null;

  return (
    <Source id="stations" type="geojson" data={stationsToGeoJSON(stations)}>
      <Layer
        id="stations-circle"
        type="circle"
        paint={{
          'circle-radius': 2,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 1,
        }}
      />
    </Source>
  );
}
