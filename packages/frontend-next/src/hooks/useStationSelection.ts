import { useMatch, useNavigate } from '@tanstack/react-router';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

import { HOUR_MS, useReports } from '@/api/reports';
import { type Station, useStations } from '@/api/transit';
import { track } from '@/lib/analytics';
import { Route as StationDetailRoute } from '@/routes/_map/station/$stationId';

type UseStationSelectionResult = {
  selectedStation: Station | undefined;
  handleMapClick: (event: MapLayerMouseEvent) => void;
};

// TODO: disambiguate single click from double-click-to-zoom so that dblclick
// zooms without flashing the station detail modal.
export function useStationSelection(): UseStationSelectionResult {
  const { data: stations } = useStations();
  const { data: reports } = useReports(HOUR_MS);
  const navigate = useNavigate();
  const match = useMatch({ from: StationDetailRoute.id, shouldThrow: false });
  const selectedStationId = match?.params.stationId;
  const selectedStation = selectedStationId ? stations?.[selectedStationId] : undefined;

  const stationsWithReport = new Set(reports?.map((report) => report.stationId));

  const handleMapClick = (event: MapLayerMouseEvent) => {
    const stationId = event.features?.[0]?.properties?.id as string | undefined;
    if (!stationId) return;
    // A report marker sits on top of this station; let the marker own the click so a near-miss
    // tap opens the report instead of the station detail underneath it.
    if (stationsWithReport.has(stationId)) return;
    track('station_selected', { source: 'map' });
    navigate({ to: StationDetailRoute.to, params: { stationId } });
  };

  return { selectedStation, handleMapClick };
}
