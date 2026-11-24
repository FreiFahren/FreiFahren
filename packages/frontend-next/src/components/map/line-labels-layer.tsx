import type { DataDrivenPropertyValueSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Map as MapLibreMap, SymbolLayerSpecification } from 'maplibre-gl';
import { useEffect } from 'react';
import { Layer, Source, useMap } from 'react-map-gl/maplibre';

import { compareLineOrder, useLines, useSegments } from '@/api/transit';

import { REPORTS_CIRCLE_LAYER_ID } from '../../hooks/useReportsLayer';

import { buildLineLabels } from './line-labels';
import { SECONDARY_LABEL_MIN_ZOOM, secondaryTypesOf, TRUNK_LABEL_MIN_ZOOM } from './line-style';
import { LABEL_FONT_BOLD, useLocalGlyphs } from './use-local-glyphs';

const BADGE_IMAGE_PREFIX = 'line-badge-';

// The badge is drawn at 2x and stretched around its text by `icon-text-fit`: only the flat middle
// stretches, so the corners keep their radius at any label length.
const BADGE_PIXEL_RATIO = 2;
const BADGE_SIZE = 20;
const BADGE_RADIUS = 7;
const BADGE_OUTLINE = 2;
// Separates a badge from its own line, which is the same colour.
const BADGE_OUTLINE_COLOR = '#212e41';

function addBadgeImage(map: MapLibreMap, color: string) {
  const id = BADGE_IMAGE_PREFIX + color;
  if (map.hasImage(id)) return;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = BADGE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const inset = BADGE_OUTLINE / 2;
  const far = BADGE_SIZE - inset;
  // `roundRect` is newer than the oldest browsers supported, so the corners are drawn as arcs.
  ctx.beginPath();
  ctx.moveTo(inset + BADGE_RADIUS, inset);
  ctx.arcTo(far, inset, far, far, BADGE_RADIUS);
  ctx.arcTo(far, far, inset, far, BADGE_RADIUS);
  ctx.arcTo(inset, far, inset, inset, BADGE_RADIUS);
  ctx.arcTo(inset, inset, far, inset, BADGE_RADIUS);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = BADGE_OUTLINE;
  ctx.strokeStyle = BADGE_OUTLINE_COLOR;
  ctx.stroke();

  const edge = BADGE_OUTLINE + BADGE_RADIUS;
  map.addImage(id, ctx.getImageData(0, 0, BADGE_SIZE, BADGE_SIZE), {
    pixelRatio: BADGE_PIXEL_RATIO,
    stretchX: [[edge, BADGE_SIZE - edge]],
    stretchY: [[edge, BADGE_SIZE - edge]],
    content: [6, 3, BADGE_SIZE - 6, BADGE_SIZE - 3],
  });
}

// Style expressions can't build an array from a number, so the per-badge shift is read off an
// interpolation between two literal offsets instead.
const MAX_OFFSET_EM = 30;
const TEXT_OFFSET: DataDrivenPropertyValueSpecification<[number, number]> = [
  'interpolate',
  ['linear'],
  ['get', 'dx'],
  -MAX_OFFSET_EM,
  ['literal', [-MAX_OFFSET_EM, 0]],
  MAX_OFFSET_EM,
  ['literal', [MAX_OFFSET_EM, 0]],
];

const LAYOUT: SymbolLayerSpecification['layout'] = {
  'symbol-placement': 'line',
  'symbol-spacing': 376,
  'symbol-sort-key': ['get', 'sortKey'],
  'text-field': ['get', 'label'],
  'text-font': LABEL_FONT_BOLD,
  'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 13],
  'text-offset': TEXT_OFFSET,
  'text-letter-spacing': 0.02,
  // Upright like a route shield, which also keeps MapLibre from re-projecting every glyph along
  // the track on each frame, as it does for text that follows a line.
  'text-rotation-alignment': 'viewport',
  'text-pitch-alignment': 'viewport',
  'text-padding': 1,
  'icon-image': ['concat', BADGE_IMAGE_PREFIX, ['get', 'color']],
  'icon-text-fit': 'both',
  // Extra clearance, so badges of different lines thin out where the network is dense.
  'icon-padding': 5,
  'icon-rotation-alignment': 'viewport',
  'icon-pitch-alignment': 'viewport',
};

const PAINT: SymbolLayerSpecification['paint'] = { 'text-color': ['get', 'textColor'] };

/** Draws each badge background the first time a label asks for it. */
function useBadgeImages() {
  const { current: mapRef } = useMap();

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;

    const addMissing = ({ id }: { id: string }) => {
      if (id.startsWith(BADGE_IMAGE_PREFIX))
        addBadgeImage(map, id.slice(BADGE_IMAGE_PREFIX.length));
    };
    map.on('styleimagemissing', addMissing);
    return () => void map.off('styleimagemissing', addMissing);
  }, [mapRef]);
}

export function LineLabelsLayer() {
  const { current: mapRef } = useMap();
  const { data: segments } = useSegments();
  const { data: lines } = useLines();
  const glyphsReady = useLocalGlyphs();
  useBadgeImages();

  if (!mapRef || !segments || !lines || !glyphsReady) return null;

  const labels = buildLineLabels(
    segments,
    [...lines].sort(compareLineOrder),
    secondaryTypesOf(lines),
  );
  // Badges go under the report markers. The reports usually load first; when they haven't, the
  // report layers are added later and land on top anyway.
  const beforeId = mapRef.getLayer(REPORTS_CIRCLE_LAYER_ID) ? REPORTS_CIRCLE_LAYER_ID : undefined;

  return (
    <Source id="line-labels" type="geojson" data={labels}>
      <Layer
        id="line-labels-secondary"
        type="symbol"
        beforeId={beforeId}
        minzoom={SECONDARY_LABEL_MIN_ZOOM}
        filter={['get', 'secondary']}
        layout={LAYOUT}
        paint={PAINT}
      />
      {/* Above the surface tier, so MapLibre places rapid transit first and it wins collisions. */}
      <Layer
        id="line-labels-trunk"
        type="symbol"
        beforeId={beforeId}
        minzoom={TRUNK_LABEL_MIN_ZOOM}
        filter={['!', ['get', 'secondary']]}
        layout={LAYOUT}
        paint={PAINT}
      />
    </Source>
  );
}
