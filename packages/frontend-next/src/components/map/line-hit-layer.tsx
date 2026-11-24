import { Layer } from 'react-map-gl/maplibre';

import { STATIONS_BASE_LAYER_ID } from './StationsLayer';
import { LINE_HIT_WIDTH } from './line-style';

type LineSource = 'segments' | 'risk-segments';

const hitLayerId = (source: LineSource) => `${source}-hit`;

// One id per source: on a switch between the line and the risk view both layers exist for a
// moment, and a shared id would let the outgoing view remove the incoming one's layer.
export const LINES_HIT_LAYER_IDS = [hitLayerId('segments'), hitLayerId('risk-segments')];

/** The lines' tap target, drawn from whichever segment source is mounted (lines or risk). */
export function LineHitLayer({ source }: { source: LineSource }) {
  return (
    <Layer
      id={hitLayerId(source)}
      source={source}
      type="line"
      beforeId={STATIONS_BASE_LAYER_ID}
      layout={{ 'line-join': 'round', 'line-cap': 'round' }}
      paint={{ 'line-width': LINE_HIT_WIDTH, 'line-opacity': 0 }}
    />
  );
}
