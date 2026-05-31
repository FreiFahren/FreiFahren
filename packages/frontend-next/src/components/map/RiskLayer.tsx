import type { FeatureCollection, LineString } from 'geojson';
import { Layer, Source } from 'react-map-gl/maplibre';

import { useRisk } from '@/api/risk';
import { type SegmentProperties, useSegments } from '@/api/transit';

import { STATIONS_BASE_LAYER_ID } from './StationsLayer';

// Neutral green for segments without elevated risk. The backend
// only returns risky (non-green) segments, so everything else falls back to this.
const NEUTRAL_GREEN = '#13C184';

type RiskSegmentProperties = SegmentProperties & { line_color: string };

export function RiskLayer() {
  const { data: segments } = useSegments();
  const { data: risk } = useRisk();

  if (!segments) return null;

  const segmentsRisk = risk?.segments_risk;
  const colored: FeatureCollection<LineString, RiskSegmentProperties> = {
    type: 'FeatureCollection',
    features: segments.features.map((feature) => ({
      ...feature,
      properties: {
        ...feature.properties,
        line_color: segmentsRisk?.[String(feature.properties.id)]?.color ?? NEUTRAL_GREEN,
      },
    })),
  };

  return (
    <Source id="risk-segments" type="geojson" data={colored}>
      <Layer
        id="risk-segments-line"
        type="line"
        beforeId={STATIONS_BASE_LAYER_ID}
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        paint={{
          'line-color': ['get', 'line_color'],
          'line-width': 3,
        }}
      />
    </Source>
  );
}
