import { Layer, Source } from 'react-map-gl/maplibre';

import { useSegments } from '@/api/transit';

export function SegmentsLayer() {
  const { data: segments } = useSegments();

  if (!segments) return null;

  return (
    <Source id="segments" type="geojson" data={segments}>
      <Layer
        id="segments-line"
        type="line"
        paint={{
          'line-color': ['get', 'color'],
          'line-width': 3,
        }}
      />
    </Source>
  );
}
