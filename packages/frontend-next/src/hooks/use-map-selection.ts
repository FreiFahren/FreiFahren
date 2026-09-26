import { useMatch, useNavigate, useRouter } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

import { compareLineOrder, type Line, type Station, useLines, useStations } from '@/api/transit';
import { LINES_HIT_LAYER_ID } from '@/components/map/LineLayer';
import { RISK_HIT_LAYER_ID } from '@/components/map/RiskLayer';
import { STATIONS_LAYER_ID } from '@/components/map/StationsLayer';
import { REPORTS_HIT_LAYER_ID, type ReportPointProps } from '@/hooks/useReportsLayer';
import { track } from '@/lib/analytics';
import { selectionTap } from '@/lib/haptics';
import { markReportViewed } from '@/lib/viewed-reports';
import { Route as LineDetailRoute } from '@/routes/_map/line/$lineName';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';
import { Route as StationDetailRoute } from '@/routes/_map/station/$stationId';

type UseMapSelectionResult = {
  selectedStation: Station | undefined;
  lineChoices: Line[];
  closeLineChoices: () => void;
  selectLine: (name: string) => void;
  handleMapClick: (event: MapLayerMouseEvent) => void;
};

// TODO: disambiguate single click from double-click-to-zoom so that dblclick
// zooms without flashing the station detail modal.
export function useMapSelection(): UseMapSelectionResult {
  const { data: stations } = useStations();
  const { data: lines } = useLines();
  const [lineChoices, setLineChoices] = useState<Line[]>([]);
  const navigate = useNavigate();
  const router = useRouter();
  const match = useMatch({ from: StationDetailRoute.id, shouldThrow: false });
  const selectedStationId = match?.params.stationId;
  const selectedStation = selectedStationId ? stations?.[selectedStationId] : undefined;

  useEffect(
    () =>
      router.subscribe('onBeforeNavigate', ({ hrefChanged }) => {
        if (hrefChanged) setLineChoices((choices) => (choices.length ? [] : choices));
      }),
    [router],
  );

  const selectLine = (name: string) => {
    setLineChoices([]);
    selectionTap();
    void navigate({
      to: LineDetailRoute.to,
      params: { lineName: name },
      search: { source: 'map' },
    });
  };

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

    const stationId = event.features?.find((feature) => feature.layer.id === STATIONS_LAYER_ID)
      ?.properties?.id as string | undefined;
    if (stationId) {
      setLineChoices([]);
      track('station_selected', { source: 'map' });
      selectionTap();
      void navigate({ to: StationDetailRoute.to, params: { stationId } });
      return;
    }

    const lineIds = new Set(
      event.features
        ?.filter(
          (feature) =>
            feature.layer.id === LINES_HIT_LAYER_ID || feature.layer.id === RISK_HIT_LAYER_ID,
        )
        .map((feature) => feature.properties?.line as string | undefined)
        .filter((id): id is string => Boolean(id)),
    );
    const uniqueLines = new Map<string, Line>();
    for (const line of lines ?? []) {
      if (lineIds.has(line.id) && !uniqueLines.has(line.name)) uniqueLines.set(line.name, line);
    }
    const choices = [...uniqueLines.values()].sort(compareLineOrder);
    if (choices.length === 1) selectLine(choices[0]!.name);
    else if (choices.length > 1) {
      selectionTap();
      setLineChoices(choices);
    }
  };

  return {
    selectedStation,
    lineChoices,
    closeLineChoices: () => setLineChoices([]),
    selectLine,
    handleMapClick,
  };
}
