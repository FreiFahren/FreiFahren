import { useCallback, useState } from 'react';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

import { type Station, useStations } from '@/api/transit';

type UseStationSelectionResult = {
  selectedStation: Station | undefined;
  handleMapClick: (event: MapLayerMouseEvent) => void;
  clearSelection: () => void;
};

// TODO: disambiguate single click from double-click-to-zoom so that dblclick
// zooms without flashing the station detail modal.
export function useStationSelection(): UseStationSelectionResult {
  const { data: stations } = useStations();
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const handleMapClick = useCallback((event: MapLayerMouseEvent) => {
    const stationId = event.features?.[0]?.properties?.id as string | undefined;
    if (stationId) setSelectedStationId(stationId);
  }, []);

  const clearSelection = useCallback(() => setSelectedStationId(null), []);

  const selectedStation = selectedStationId ? stations?.[selectedStationId] : undefined;

  return {
    selectedStation,
    handleMapClick,
    clearSelection,
  };
}
