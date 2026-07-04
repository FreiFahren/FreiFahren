import 'maplibre-gl/dist/maplibre-gl.css';
import './Map.css';

import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { useEffect, useState } from 'react';
import { Map as MapGL } from 'react-map-gl/maplibre';

// Register the `pmtiles://` protocol so MapLibre can range-read the static PMTiles basemap archive
// directly from R2 (see packages/tile-server). This runs once when the lazy map chunk loads, before
// the map mounts. The shared instance lets the Capacitor offline path register a locally-cached
// archive on it (see prepareOfflineBasemap).
const pmtilesProtocol = new Protocol();
maplibregl.addProtocol('pmtiles', pmtilesProtocol.tile);

import { useRisk } from '@/api/risk';
import { useSegments } from '@/api/transit';
import { currentCity } from '@/lib/city';

import { LineLayer } from './LineLayer';
import { MapCameraController } from './MapCameraController';
import { ReportsLayer } from './ReportsLayer';
import { RiskLayer } from './RiskLayer';
import { STATIONS_LAYER_ID, StationsLayer } from './StationsLayer';
import { UserLocationControl } from './UserLocationControl';
import { REPORTS_HIT_LAYER_ID } from '../../hooks/useReportsLayer';
import { useRiskLayer } from '../../hooks/useRiskLayer';
import { useStationSelection } from '../../hooks/useStationSelection';

const MAP_STYLE_URL = currentCity.map.styleUrl;

const INITIAL_VIEW = {
  longitude: currentCity.map.center[0],
  latitude: currentCity.map.center[1],
  zoom: currentCity.map.zoom,
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

  // On web the style is just the URL (MapLibre fetches it, and the SW + immutable HTTP cache handle
  // offline). The Capacitor build has no service worker, so it resolves the style + a locally-cached
  // PMTiles archive itself; we hold the map until that's ready to avoid a network-style first paint.
  const [mapStyle, setMapStyle] = useState<string | StyleSpecification | null>(
    __CAPACITOR__ ? null : MAP_STYLE_URL,
  );
  useEffect(() => {
    if (!__CAPACITOR__) return;
    let cancelled = false;
    void import('@/lib/offline-basemap')
      .then(({ prepareOfflineBasemap }) => prepareOfflineBasemap(MAP_STYLE_URL, pmtilesProtocol))
      .then((style) => {
        if (!cancelled) setMapStyle(style);
      })
      .catch(() => {
        if (!cancelled) setMapStyle(MAP_STYLE_URL);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the overlay data now — in parallel with the base-map style and tiles — even though we
  // hold off *rendering* the overlays until the base map has painted (below). The fetches must
  // not wait for the layers to mount, or the lines/reports would visibly lag the map. (Stations
  // and reports are already warmed by useStationSelection; this covers the segments/risk data.)
  useSegments();
  useRisk();

  // Capacitor only: the offline basemap resolves async, so hold the container until it's ready. On
  // web mapStyle is the URL synchronously, so this branch never runs.
  if (!mapStyle) return <div className="fixed inset-0" />;

  return (
    <div className="fixed inset-0">
      <MapGL
        initialViewState={INITIAL_VIEW}
        minZoom={MIN_ZOOM}
        mapStyle={mapStyle}
        pixelRatio={PIXEL_RATIO}
        // 0 disables MapLibre's label cross-fade, which otherwise re-renders frames after every
        // pan/zoom and tile load — needless CPU churn on a dense transit map.
        fadeDuration={0}
        attributionControl={{ compact: true }}
        interactiveLayerIds={[REPORTS_HIT_LAYER_ID, STATIONS_LAYER_ID]}
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
            <MapCameraController />
          </>
        )}
      </MapGL>
    </div>
  );
}
