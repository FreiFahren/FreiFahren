import 'maplibre-gl/dist/maplibre-gl.css';
import './Map.css';

import { useState } from 'react';
import { Map as MapGL } from 'react-map-gl/maplibre';

import { useRisk } from '@/api/risk';
import { useSegments } from '@/api/transit';
import { requireEnv } from '@/lib/utils';

import { LineLayer } from './LineLayer';
import { ReportsLayer } from './ReportsLayer';
import { RiskLayer } from './RiskLayer';
import { STATIONS_LAYER_ID, StationsLayer } from './StationsLayer';
import { UserLocationControl } from './UserLocationControl';
import { useRiskLayer } from '../../hooks/useRiskLayer';
import { useStationSelection } from '../../hooks/useStationSelection';

const MAP_STYLE_URL = requireEnv('VITE_MAP_STYLE_URL');

const INITIAL_VIEW = {
  longitude: requireEnv('VITE_MAP_CENTER_LNG', 'number'),
  latitude: requireEnv('VITE_MAP_CENTER_LAT', 'number'),
  zoom: requireEnv('VITE_MAP_INITIAL_ZOOM', 'number'),
};

// Keep the city in view: stop users from zooming out past the metro-area level.
const MIN_ZOOM = 10;

// Cap render resolution at 2x: iPhones report devicePixelRatio 3 (~9x the CSS pixels), the dominant
// GPU/CPU cost and the first thing iOS Low Power Mode throttles. 2x stays crisp but ~halves the work.
const MAX_PIXEL_RATIO = 2;
const PIXEL_RATIO = Math.min(
  typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
  MAX_PIXEL_RATIO,
);

export function MapView() {
  const { selectedStation, handleMapClick } = useStationSelection();
  const { visible: riskVisible } = useRiskLayer();
  const [baseMapReady, setBaseMapReady] = useState(false);

  // Fetch the overlay data now — in parallel with the base-map style and tiles — even though we
  // hold off *rendering* the overlays until the base map has painted (below). The fetches must
  // not wait for the layers to mount, or the lines/reports would visibly lag the map. (Stations
  // and reports are already warmed by useStationSelection; this covers the segments/risk data.)
  useSegments();
  useRisk();

  return (
    <div className="fixed inset-0">
      <MapGL
        initialViewState={INITIAL_VIEW}
        minZoom={MIN_ZOOM}
        mapStyle={MAP_STYLE_URL}
        pixelRatio={PIXEL_RATIO}
        // 0 disables MapLibre's label cross-fade, which otherwise re-renders frames after every
        // pan/zoom and tile load — needless CPU churn on a dense transit map.
        fadeDuration={0}
        attributionControl={{ compact: true }}
        interactiveLayerIds={[STATIONS_LAYER_ID]}
        onClick={handleMapClick}
        // Let the base map render its first frame before we add the GeoJSON sources and the
        // report markers, so that overlay setup doesn't compete with the heaviest part of map
        // init. The map is persistent, so this fires once per session.
        onLoad={() => setBaseMapReady(true)}
        // The style is baked and version-pinned by the tile-server, so re-validating its 89 layers
        // against the spec on every load is wasted main-thread work at the most contended moment
        // (and lets maplibre tree-shake the validator out). See maplibre MapOptions.validateStyle.
        validateStyle={false}
        // App is city-wide, so no world copies are visible.
        renderWorldCopies={false}
      >
        {baseMapReady && (
          <>
            <StationsLayer selectedStation={selectedStation} />
            {riskVisible ? <RiskLayer /> : <LineLayer />}
            <ReportsLayer />
            <UserLocationControl />
          </>
        )}
      </MapGL>
    </div>
  );
}
