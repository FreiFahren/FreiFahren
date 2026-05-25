import 'maplibre-gl/dist/maplibre-gl.css';
import './Map.css';

import { Map as MapGL } from 'react-map-gl/maplibre';

import { requireEnv } from '@/lib/utils';

const MAP_STYLE_URL = requireEnv('VITE_MAP_STYLE_URL');

const INITIAL_VIEW = {
  longitude: requireEnv('VITE_MAP_CENTER_LNG', 'number'),
  latitude: requireEnv('VITE_MAP_CENTER_LAT', 'number'),
  zoom: requireEnv('VITE_MAP_INITIAL_ZOOM', 'number'),
};

export function Map() {
  return (
    <div className="fixed inset-0">
      <MapGL
        initialViewState={INITIAL_VIEW}
        mapStyle={MAP_STYLE_URL}
        attributionControl={{ compact: true }}
      />
    </div>
  );
}
