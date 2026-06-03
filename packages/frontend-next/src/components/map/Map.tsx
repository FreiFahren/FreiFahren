import 'maplibre-gl/dist/maplibre-gl.css';
import './Map.css';

import { Map as MapGL } from 'react-map-gl/maplibre';

import { requireEnv } from '@/lib/utils';

import { LineLayer } from './LineLayer';
import { ReportsLayer } from './ReportsLayer';
import { RiskLayer } from './RiskLayer';
import { STATIONS_LAYER_ID, StationsLayer } from './StationsLayer';
import { UserLocationLayer } from './UserLocationLayer';
import { useRiskLayer } from '../../hooks/useRiskLayer';
import { useStationSelection } from '../../hooks/useStationSelection';

const MAP_STYLE_URL = requireEnv('VITE_MAP_STYLE_URL');

const INITIAL_VIEW = {
  longitude: requireEnv('VITE_MAP_CENTER_LNG', 'number'),
  latitude: requireEnv('VITE_MAP_CENTER_LAT', 'number'),
  zoom: requireEnv('VITE_MAP_INITIAL_ZOOM', 'number'),
};

export function MapView() {
  const { selectedStation, handleMapClick } = useStationSelection();
  const { visible: riskVisible } = useRiskLayer();

  return (
    <div className="fixed inset-0">
      <MapGL
        initialViewState={INITIAL_VIEW}
        mapStyle={MAP_STYLE_URL}
        attributionControl={{ compact: true }}
        interactiveLayerIds={[STATIONS_LAYER_ID]}
        onClick={handleMapClick}
      >
        <StationsLayer selectedStation={selectedStation} />
        {riskVisible ? <RiskLayer /> : <LineLayer />}
        <ReportsLayer />
        <UserLocationLayer />
      </MapGL>
    </div>
  );
}
