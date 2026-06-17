import { useParams } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useMap } from 'react-map-gl/maplibre';

import { useStations } from '@/api/transit';

// Only ever zoom *in* to frame a target — never pull back a user already closer (see Math.max below).
const DETAIL_ZOOM = 14;
// Keep the marker above the detail bottom sheet by padding the camera's bottom by ~the sheet height.
const DETAIL_PANEL_PADDING_BOTTOM = 320;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function MapCameraController() {
  const { current: map } = useMap();
  const { data: stations } = useStations();
  const targetId = useParams({ strict: false, select: (params) => params.stationId });

  // The id last framed. Guards against re-flying to a station already in view — including when the
  // panel closes and the same station is re-selected, or when `stations`/`map` change identity.
  const positionedForIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!map || !stations || !targetId) return;
    if (targetId === positionedForIdRef.current) return;

    const station = stations[targetId];
    if (!station) return;

    positionedForIdRef.current = targetId;
    const { longitude, latitude } = station.coordinates;
    const camera = {
      center: [longitude, latitude] as [number, number],
      zoom: Math.max(map.getZoom(), DETAIL_ZOOM),
      padding: { bottom: DETAIL_PANEL_PADDING_BOTTOM },
    };

    if (prefersReducedMotion()) map.jumpTo(camera);
    else map.flyTo(camera);
  }, [map, stations, targetId]);

  return null;
}
