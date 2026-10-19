import { LocateFixed } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { type MapRef, useControl, useMap } from 'react-map-gl/maplibre';

import { Button } from '@/components/ui/button';
import { type UserPosition, useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import { selectionTap } from '@/lib/haptics';
import { prefersReducedMotion } from '@/lib/reduced-motion';

import { NAMESPACE } from './center-on-user-button.i18n';

// Close enough to pick out the nearest stations, but never pull back a user already zoomed further.
const CENTER_ZOOM = 15;
// Measured in screen pixels so "centered" means the same thing at every zoom level, with enough
// slack that a slight nudge or GPS jitter doesn't flash the button.
const OFF_CENTER_PX = 32;

function isCenteredOn(map: MapRef, position: UserPosition): boolean {
  const center = map.project(map.getCenter());
  const user = map.project([position.lng, position.lat]);
  return Math.hypot(center.x - user.x, center.y - user.y) <= OFF_CENTER_PX;
}

function moveCamera(map: MapRef, camera: Parameters<MapRef['jumpTo']>[0], animate: 'fly' | 'ease') {
  if (prefersReducedMotion()) map.jumpTo(camera);
  else if (animate === 'fly') map.flyTo(camera);
  else map.easeTo(camera);
}

/**
 * Google Maps-style re-center control. While the map is centered on the user it stays hidden and
 * the camera follows their position; once they pan away it appears, and tapping it re-centers and
 * resumes following. Mounted as a MapLibre control so it stacks above the attribution in the
 * bottom-right corner instead of being positioned around it by hand.
 */
export function CenterOnUserButton() {
  const { t } = useTranslation(NAMESPACE);
  const { current: map } = useMap();
  const { position } = useGeolocation();
  const container = useControl(
    () => {
      const element = document.createElement('div');
      element.className = 'maplibregl-ctrl';
      return { onAdd: () => element, onRemove: () => element.remove(), element };
    },
    { position: 'bottom-right' },
  ).element;

  const [following, setFollowing] = useState(false);
  // Map event handlers outlive renders, so they read the latest values through refs.
  const followingRef = useRef(false);
  const positionRef = useRef(position);
  // Mid-flight to the user the center is still far off; judging it then would flash the button.
  const recenteringRef = useRef(false);

  const updateFollowing = (next: boolean) => {
    followingRef.current = next;
    setFollowing(next);
  };

  useEffect(() => {
    if (!map) return;
    const onMove = () => {
      if (recenteringRef.current) return;
      const current = positionRef.current;
      updateFollowing(current !== null && isCenteredOn(map, current));
    };
    const onMoveEnd = () => {
      recenteringRef.current = false;
      onMove();
    };
    map.on('move', onMove);
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('move', onMove);
      map.off('moveend', onMoveEnd);
    };
  }, [map]);

  useEffect(() => {
    positionRef.current = position;
    if (!map || !position) return;
    // Don't yank the camera out from under a gesture that is still in progress.
    if (followingRef.current && !map.isMoving()) {
      recenteringRef.current = true;
      moveCamera(map, { center: [position.lng, position.lat] }, 'ease');
    } else if (!followingRef.current) {
      updateFollowing(isCenteredOn(map, position));
    }
  }, [map, position]);

  if (!position || following) return null;

  const center = () => {
    if (!map) return;
    selectionTap();
    track('map_centered_on_user', {});
    recenteringRef.current = true;
    updateFollowing(true);
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
        <LocateFixed className="size-5" />
      </Button>
    </div>,
    container,
  );
}
