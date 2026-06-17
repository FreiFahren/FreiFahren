import { Layer, Source } from 'react-map-gl/maplibre';

import {
  REPORTS_CIRCLE_LAYER_ID,
  REPORTS_HIT_LAYER_ID,
  useReportsLayer,
} from '@/hooks/useReportsLayer';

import { ReportPulseMarker } from './ReportPulseMarker';

const DOT_RADIUS = 8;
const DOT_STROKE_WIDTH = 2;
const REPORT_COLOR = '#d63b3b';

export function ReportsLayer() {
  const data = useReportsLayer();

  if (!data) return null;

  return (
    <>
      <Source id="reports" type="geojson" data={data}>
        {/* Pulsing reports render as DOM markers (ReportPulseMarker), so exclude them here. */}
        <Layer
          id={REPORTS_CIRCLE_LAYER_ID}
          type="circle"
          filter={['!=', ['get', 'pulse'], true]}
          paint={{
            'circle-radius': DOT_RADIUS,
            'circle-color': REPORT_COLOR,
            'circle-opacity': ['get', 'opacity'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': DOT_STROKE_WIDTH,
            'circle-stroke-opacity': ['get', 'opacity'],
          }}
        />
        {/* Transparent hit target; owns clicks for pulsing reports too, whose DOM marker passes them through. */}
        <Layer
          id={REPORTS_HIT_LAYER_ID}
          type="circle"
          paint={{ 'circle-radius': 14, 'circle-color': '#000000', 'circle-opacity': 0 }}
        />
      </Source>
      {data.features
        .filter((feature) => feature.properties.pulse)
        .map((feature) => (
          <ReportPulseMarker
            key={`${feature.properties.stationId}-${feature.properties.timestamp}`}
            longitude={feature.geometry.coordinates[0]}
            latitude={feature.geometry.coordinates[1]}
            opacity={feature.properties.opacity}
          />
        ))}
    </>
  );
}
