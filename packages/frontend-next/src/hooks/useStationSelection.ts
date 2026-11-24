import { useMatch, useNavigate, useRouter } from '@tanstack/react-router';
import { useDeferredValue, useEffect, useState } from 'react';
import type { MapLayerMouseEvent, MapLayerTouchEvent } from 'react-map-gl/maplibre';

import { stationInsightsQueryOptions } from '@/api/insights';
import { queryClient } from '@/api/queryClient';
import { compareLineOrder, type Station, useLines, useStations } from '@/api/transit';
import { LINES_HIT_LAYER_IDS } from '@/components/map/line-hit-layer';
import { STATIONS_LAYER_ID } from '@/components/map/StationsLayer';
import { track } from '@/lib/analytics';
import { selectionTap } from '@/lib/haptics';
import { createTapConfirmation } from '@/lib/tap-confirmation';
import { tappedLines } from '@/lib/tapped-lines';
import { markReportViewed } from '@/lib/viewed-reports';
import { REPORTS_HIT_LAYER_ID, type ReportPointProps } from '@/hooks/useReportsLayer';
import { Route as LineDetailRoute } from '@/routes/_map/line/$lineName';
import { Route as LinePickerRoute } from '@/routes/_map/line/index';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';
import { Route as StationDetailRoute } from '@/routes/_map/station/$stationId';

type UseStationSelectionResult = {
  selectedStation: Station | undefined;
  handleMapClick: (event: MapLayerMouseEvent) => void;
  handleMapTouchStart: (event: MapLayerTouchEvent) => void;
  handleMapDragStart: () => void;
};

export function useStationSelection(): UseStationSelectionResult {
  const { data: stations } = useStations();
  const { data: lines } = useLines();
  const navigate = useNavigate();
  const router = useRouter();
  const match = useMatch({ from: StationDetailRoute.id, shouldThrow: false });
  // Restyling the selected station re-renders the map on the main thread. Deferring it lets the
  // detail sheet, which mounts in the same navigation, paint first.
  const selectedStationId = useDeferredValue(match?.params.stationId);
  const selectedStation = selectedStationId ? stations?.[selectedStationId] : undefined;

  // A tap only selects once it can no longer become a double tap, which zooms instead. Nothing on
  // the map reacts before that, so the first tap of a double tap leaves no trace.
  const [taps] = useState(createTapConfirmation);
  useEffect(
    () => () => {
      taps.cancel();
    },
    [taps],
  );

  const selectOnceConfirmed = (point: { x: number; y: number }, onSelect: () => void) => {
    const { href } = router.state.location;
    taps.tap(point, () => {
      // The user navigated elsewhere during the wait, e.g. through a control over the map.
      if (router.state.location.href !== href) return;
      selectionTap();
      onSelect();
    });
  };

  const handleMapClick = (event: MapLayerMouseEvent) => {
    // The second click of a mouse double click, which zooms. The click count stays raised for
    // longer than a tap is held back, so it only counts while the first click is still pending.
    if (event.originalEvent.detail > 1 && taps.cancel()) return;

    // A report dot sits on top of its station. Let the report win the click — a tap on (or near)
    // it opens the report detail instead of the station detail underneath.
    const reportFeature = event.features?.find(
      (feature) => feature.layer.id === REPORTS_HIT_LAYER_ID,
    );
    if (reportFeature) {
      const { stationId, timestamp } = reportFeature.properties as ReportPointProps;
      selectOnceConfirmed(event.point, () => {
        const ageMinutes = Math.round((Date.now() - new Date(timestamp).getTime()) / 60000);
        track('report_marker_selected', { report_age_minutes: ageMinutes });
        markReportViewed(stationId, timestamp);
        void navigate({ to: ReportDetailRoute.to, params: { stationId } });
      });
      return;
    }

    // The wait is used to load the detail route's code and data, so the sheet can open filled the
    // moment the tap is confirmed. A double tap wastes the preload, which is cheap. Reports need
    // none of this: useReportsLayer already warms every visible report's route.
    const stationId = event.features?.find((feature) => feature.layer.id === STATIONS_LAYER_ID)
      ?.properties.id as string | undefined;
    if (stationId) {
      const destination = { to: StationDetailRoute.to, params: { stationId } };
      void router.preloadRoute(destination).catch(() => undefined);
      void queryClient.prefetchQuery(stationInsightsQueryOptions(stationId));
      selectOnceConfirmed(event.point, () => {
        track('station_selected', { source: 'map' });
        void navigate(destination);
      });
      return;
    }

    // Lines come last: a station or report on a line is the more specific target.
    const lineNames = tappedLines(event.features, LINES_HIT_LAYER_IDS, lines)
      .sort(compareLineOrder)
      .map((line) => line.name);
    const [lineName] = lineNames;
    if (!lineName) return;
    const onSelect = () => track('map_line_selected', { line_count: lineNames.length });

    if (lineNames.length === 1) {
      const destination = {
        to: LineDetailRoute.to,
        params: { lineName },
        search: { source: 'map' },
      } as const;
      void router.preloadRoute(destination).catch(() => undefined);
      selectOnceConfirmed(event.point, () => {
        onSelect();
        void navigate(destination);
      });
      return;
    }

    // Several lines under the tap, as on a shared track: the user picks which one they meant.
    const destination = { to: LinePickerRoute.to, search: { names: lineNames } };
    void router.preloadRoute(destination).catch(() => undefined);
    selectOnceConfirmed(event.point, () => {
      onSelect();
      void navigate(destination);
    });
  };

  const handleMapTouchStart = (event: MapLayerTouchEvent) => {
    // A second finger starts a pinch, which is not a selection either.
    if (event.originalEvent.touches.length === 1) taps.touch(event.point);
    else taps.cancel();
  };

  // Panning away right after a tap is not a selection.
  const handleMapDragStart = () => {
    taps.cancel();
  };

  return { selectedStation, handleMapClick, handleMapTouchStart, handleMapDragStart };
}
