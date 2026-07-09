import { Layer, Source } from 'react-map-gl/maplibre';

import { STATIONS_BASE_LAYER_ID } from './StationsLayer';
import { LINE_OPACITY, LINE_WIDTH, useTypedSegments } from './line-style';

export function LineLayer() {
  const segments = useTypedSegments();

  if (!segments) return null;

  return (
    <Source id="segments" type="geojson" data={segments}>
      <Layer
        id="segments-line"
        type="line"
        beforeId={STATIONS_BASE_LAYER_ID}
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        paint={{
          'line-color': ['get', 'color'],
          'line-width': LINE_WIDTH,
          'line-opacity': LINE_OPACITY,
        }}
      />
    </Source>
  );
}
