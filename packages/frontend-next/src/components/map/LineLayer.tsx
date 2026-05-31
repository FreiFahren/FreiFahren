import { Layer, Source } from 'react-map-gl/maplibre';

import { useSegments } from '@/api/transit';

import { STATIONS_BASE_LAYER_ID } from './StationsLayer';

export function LineLayer() {
  const { data: segments } = useSegments();

  if (!segments) return null;

  return (
    <Source id="segments" type="geojson" data={segments}>
      <Layer
        id="segments-line"
        type="line"
        beforeId={STATIONS_BASE_LAYER_ID}
        paint={{
          'line-color': ['get', 'color'],
          'line-width': 3,
        }}
      />
    </Source>
  );
}
