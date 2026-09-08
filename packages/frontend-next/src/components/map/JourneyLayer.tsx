import type { FeatureCollection, LineString } from 'geojson';
import { Layer, Source } from 'react-map-gl/maplibre';

import { type SegmentProperties, useSegments } from '@/api/transit';
import { useJourneyHighlight } from '@/hooks/use-journey-highlight';

import { STATIONS_BASE_LAYER_ID } from './StationsLayer';

/**
 * Outlines the segments of the journey on screen. The geometry is already in the client
 * cache for the map itself, so this filters what is there rather than fetching anything.
 */
export function JourneyLayer() {
  const segments = useSegments();
  const highlighted = useJourneyHighlight();

  if (!segments.data || highlighted.length === 0) return null;

  const wanted = new Set(highlighted);
  const features = segments.data.features.filter((feature) => wanted.has(feature.properties.id));
  if (features.length === 0) return null;

  const collection: FeatureCollection<LineString, SegmentProperties> = {
    type: 'FeatureCollection',
    features,
  };

  return (
    <Source id="journey-segments" type="geojson" data={collection}>
      {/* Drawn under the station markers so labels stay readable. */}
      <Layer
        id="journey-segments-halo"
        type="line"
        beforeId={STATIONS_BASE_LAYER_ID}
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        paint={{
          'line-color': '#ffffff',
          'line-width': 9,
          'line-opacity': 0.9,
        }}
      />
      <Layer
        id="journey-segments-line"
        type="line"
        beforeId={STATIONS_BASE_LAYER_ID}
        layout={{ 'line-join': 'round', 'line-cap': 'round' }}
        paint={{
          'line-color': '#111827',
          'line-width': 4,
          'line-opacity': 0.95,
        }}
      />
    </Source>
  );
}
