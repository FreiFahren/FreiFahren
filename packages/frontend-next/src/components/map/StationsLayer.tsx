import type { ExpressionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { SymbolLayerSpecification } from 'maplibre-gl';
import { Layer, Source } from 'react-map-gl/maplibre';

import { type Station } from '@/api/transit';

import {
  STATION_NAME_MIN_ZOOM,
  stationHitRadius,
  stationNameFilter,
  stationOpacity,
  useTrunkStationsGeoJSON,
} from './line-style';
import { LABEL_FONT_MEDIUM, useLocalGlyphs } from './use-local-glyphs';

// Bottom-most (visible) station layer. Line layers insert `beforeId` this so they always render
// beneath the station dots, regardless of mount order when toggling between line/risk layers.
export const STATIONS_BASE_LAYER_ID = 'stations-circle';
export const STATIONS_LAYER_ID = 'stations-hit';

type StationsLayerProps = {
  selectedStation: Station | undefined;
};

const NAME_LAYOUT: SymbolLayerSpecification['layout'] = {
  'symbol-sort-key': ['get', 'labelSortKey'],
  'text-field': ['get', 'name'],
  'text-font': LABEL_FONT_MEDIUM,
  'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10.5, 16, 12.5],
  'text-max-width': 9,
  'text-line-height': 1.1,
  // Beside the dot where there's room, otherwise whichever side is free.
  'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
  // Further out at a reported station, whose marker is wider than the dot and would cover the
  // start of the name.
  'text-radial-offset': ['case', ['get', 'reported'], 1.1, 0.7],
  'text-justify': 'auto',
  'text-padding': 4,
};

const NAME_HALO = { 'text-halo-color': '#212e41', 'text-halo-width': 1.4 };

export function StationsLayer({ selectedStation }: StationsLayerProps) {
  const stations = useTrunkStationsGeoJSON();
  const glyphsReady = useLocalGlyphs();

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
      {glyphsReady && (
        <Layer
          id="stations-name"
          type="symbol"
          // Under the tap targets, the report markers and the line badges, which are added later
          // and so are placed first: a name gives way to a badge, never the other way round.
          beforeId={STATIONS_LAYER_ID}
          minzoom={STATION_NAME_MIN_ZOOM}
          filter={stationNameFilter(selectedId)}
          layout={NAME_LAYOUT}
          // Dimmer than the badges and the dots, so names read as annotation, not as markers.
          paint={{ ...NAME_HALO, 'text-color': '#c9d1df' }}
        />
      )}
      {glyphsReady && (
        // The selected station is named at any zoom and in any tier, so it has a layer without
        // the zoom floor and the tier filter. Above the other names, so it is placed before them.
        <Layer
          id="stations-name-selected"
          type="symbol"
          beforeId={STATIONS_LAYER_ID}
          filter={isSelected}
          layout={NAME_LAYOUT}
          paint={{ ...NAME_HALO, 'text-color': '#ffffff' }}
        />
      )}
    </Source>
  );
}
