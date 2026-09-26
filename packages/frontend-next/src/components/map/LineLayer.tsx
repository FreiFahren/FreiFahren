import { Layer, Source } from 'react-map-gl/maplibre';

import { STATIONS_BASE_LAYER_ID } from './StationsLayer';
import { LINE_OPACITY, LINE_WIDTH, useTypedSegments } from './line-style';

export const LINES_HIT_LAYER_ID = 'segments-hit';

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
      <Layer
        id={LINES_HIT_LAYER_ID}
        type="line"
        beforeId={STATIONS_BASE_LAYER_ID}
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        paint={{ 'line-width': 14, 'line-color': '#000000', 'line-opacity': 0 }}
      />
    </Source>
  );
}
