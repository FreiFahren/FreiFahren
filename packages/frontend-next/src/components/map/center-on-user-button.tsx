import { useParams } from '@tanstack/react-router';
import { Navigation } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { type MapRef, useControl, useMap } from 'react-map-gl/maplibre';

import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import { currentCity } from '@/lib/city';
import { pointInBounds } from '@/lib/city-for-position';
import { selectionTap } from '@/lib/haptics';
import { prefersReducedMotion } from '@/lib/reduced-motion';

import { NAMESPACE } from './center-on-user-button.i18n';

// Close enough to pick out the nearest stations, but never pull back a user already zoomed further.
const CENTER_ZOOM = 13;
// Tags our own camera moves (MapLibre merges eventData into the move events), so any other move —
// a gesture or a station being framed — is what ends following.
const FOLLOW_MOVE = { followUser: true };

function moveCamera(map: MapRef, camera: Parameters<MapRef['jumpTo']>[0], animate: 'fly' | 'ease') {
  if (prefersReducedMotion()) map.jumpTo(camera, FOLLOW_MOVE);
  else if (animate === 'fly') map.flyTo(camera, FOLLOW_MOVE);
  else map.easeTo(camera, FOLLOW_MOVE);
}

/**
 * Google Maps-style re-center control. While following, the camera tracks the user's position and
 * the button is hidden; any camera move we didn't make ends following and shows it, and tapping it
 * re-centers and resumes. Mounted as a MapLibre control so it stacks above the attribution in the
 * bottom-right corner instead of being positioned around it by hand.
 */
export function CenterOnUserButton() {
  const { t } = useTranslation(NAMESPACE);
  const { current: map } = useMap();
  const { position: rawPosition } = useGeolocation();
  // The basemap only covers the current city, so a fix elsewhere (e.g. right after switching to
  // another city) is neither followed nor offered as a re-center target.
  const position =
    rawPosition && pointInBounds(rawPosition.lng, rawPosition.lat, currentCity)
      ? rawPosition
      : null;
  const stationId = useParams({ strict: false, select: (params) => params.stationId });
  const container = useControl(
    () => {
      const element = document.createElement('div');
      element.className = 'maplibregl-ctrl';
      return { onAdd: () => element, onRemove: () => element.remove(), element };
    },
    { position: 'bottom-right' },
  ).element;

  // Start out following so the first fix centers the map, unless a station link is framing it.
  const [following, setFollowing] = useState(!stationId);

  useEffect(() => {
    if (!map) return;
    const onMoveStart = (event: { followUser?: boolean }) => {
      if (!event.followUser) setFollowing(false);
    };
    map.on('movestart', onMoveStart);
    return () => {
      map.off('movestart', onMoveStart);
    };
  }, [map]);

  const followPosition = useEffectEvent(() => {
    // Don't yank the camera out from under a gesture that is still in progress.
    if (!map || !position || !following || map.isMoving()) return;
    moveCamera(map, { center: [position.lng, position.lat] }, 'ease');
  });
  useEffect(() => followPosition(), [position]);

  if (!position || following) return null;

  const center = () => {
    if (!map) return;
    selectionTap();
    track('map_centered_on_user', {});
    setFollowing(true);
    moveCamera(
      map,
      {
        center: [position.lng, position.lat],
        zoom: Math.max(map.getZoom(), CENTER_ZOOM),
      },
      'fly',
    );
  };

  return createPortal(
    <div className="pb-1.5">
      <Button
        type="button"
        variant="secondary"
        size="icon"
        onClick={center}
        aria-label={t('center')}
        className="bg-card text-foreground hover:bg-card/80 size-11 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
      >
        <Navigation className="size-5" />
      </Button>
    </div>,
    container,
  );
}
