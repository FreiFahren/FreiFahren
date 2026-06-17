import { useMatch, useNavigate } from '@tanstack/react-router';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

import { type Station, useStations } from '@/api/transit';
import { track } from '@/lib/analytics';
import { selectionTap } from '@/lib/haptics';
import { markReportViewed } from '@/lib/viewed-reports';
import { REPORTS_HIT_LAYER_ID, type ReportPointProps } from '@/hooks/useReportsLayer';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';
import { Route as StationDetailRoute } from '@/routes/_map/station/$stationId';

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
    // A report dot sits on top of its station. Let the report win the click — a tap on (or near)
    // it opens the report detail instead of the station detail underneath.
    const reportFeature = event.features?.find(
      (feature) => feature.layer.id === REPORTS_HIT_LAYER_ID,
    );
    if (reportFeature) {
      const { stationId, timestamp } = reportFeature.properties as ReportPointProps;
      const ageMinutes = Math.round((Date.now() - new Date(timestamp).getTime()) / 60000);
      track('report_marker_selected', { report_age_minutes: ageMinutes });
      selectionTap();
      markReportViewed(stationId, timestamp);
      void navigate({ to: ReportDetailRoute.to, params: { stationId } });
      return;
    }

    const stationId = event.features?.find((feature) => feature.properties?.id)?.properties?.id as
      | string
      | undefined;
    if (!stationId) return;
    track('station_selected', { source: 'map' });
    selectionTap();
    navigate({ to: StationDetailRoute.to, params: { stationId } });
  };

  return { selectedStation, handleMapClick };
}
