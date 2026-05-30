import { useMatch, useNavigate } from '@tanstack/react-router';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

import { type Station, useStations } from '@/api/transit';
import { Route as StationDetailRoute } from '@/routes/_map/stations/$stationId';

type UseStationSelectionResult = {
  selectedStation: Station | undefined;
  handleMapClick: (event: MapLayerMouseEvent) => void;
};

// TODO: disambiguate single click from double-click-to-zoom so that dblclick
// zooms without flashing the station detail modal.
export function useStationSelection(): UseStationSelectionResult {
  const { data: stations } = useStations();
  const navigate = useNavigate();
  const match = useMatch({ from: StationDetailRoute.id, shouldThrow: false });
  const selectedStationId = match?.params.stationId;
  const selectedStation = selectedStationId ? stations?.[selectedStationId] : undefined;

  const handleMapClick = (event: MapLayerMouseEvent) => {
    const stationId = event.features?.[0]?.properties?.id as string | undefined;
    if (stationId) navigate({ to: StationDetailRoute.to, params: { stationId } });
  };

  return { selectedStation, handleMapClick };
}
