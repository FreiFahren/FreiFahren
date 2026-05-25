import 'maplibre-gl/dist/maplibre-gl.css';
import './Map.css';

import { Map as MapGL } from 'react-map-gl/maplibre';

const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL;

const INITIAL_VIEW = {
  longitude: Number(import.meta.env.VITE_MAP_CENTER_LNG),
  latitude: Number(import.meta.env.VITE_MAP_CENTER_LAT),
  zoom: Number(import.meta.env.VITE_MAP_INITIAL_ZOOM),
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
