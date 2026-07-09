import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { Layer, Source } from 'react-map-gl/maplibre';

import { type Station } from '@/api/transit';

import { stationHitRadius, stationOpacity, useTrunkStationsGeoJSON } from './line-style';

// Bottom-most (visible) station layer. Line layers insert `beforeId` this so they always render
// beneath the station dots, regardless of mount order when toggling between line/risk layers.
export const STATIONS_BASE_LAYER_ID = 'stations-circle';
export const STATIONS_LAYER_ID = 'stations-hit';

type StationsLayerProps = {
  selectedStation: Station | undefined;
};

export function StationsLayer({ selectedStation }: StationsLayerProps) {
  const stations = useTrunkStationsGeoJSON();

  if (!stations) return null;

  const selectedId = selectedStation?.id ?? '';
  const isSelected: ExpressionSpecification = ['==', ['get', 'id'], selectedId];
  const opacity = stationOpacity(selectedId);

  return (
    <Source id="stations" type="geojson" data={stations}>
      <Layer
        id={STATIONS_BASE_LAYER_ID}
        type="circle"
        paint={{
          'circle-radius': ['case', isSelected, 5, 2],
          'circle-color': '#ffffff',
          'circle-stroke-color': '#000000',
          'circle-stroke-width': 1,
          'circle-opacity': opacity,
          'circle-stroke-opacity': opacity,
        }}
      />
      <Layer
        id={STATIONS_LAYER_ID}
        type="circle"
        paint={{
          'circle-radius': stationHitRadius(selectedId),
          'circle-color': '#000000',
          'circle-opacity': 0,
        }}
      />
    </Source>
  );
}
