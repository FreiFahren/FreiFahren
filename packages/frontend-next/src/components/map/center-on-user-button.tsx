import { LocateFixed } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useControl, useMap } from 'react-map-gl/maplibre';

import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import { selectionTap } from '@/lib/haptics';
import { prefersReducedMotion } from '@/lib/reduced-motion';

import { NAMESPACE } from './center-on-user-button.i18n';

// Close enough to pick out the nearest stations, but never pull back a user already zoomed further.
const CENTER_ZOOM = 15;

/**
 * Re-centers the map on the shared location. Mounted as a MapLibre control so it stacks above the
 * attribution in the bottom-right corner instead of being positioned around it by hand.
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

  if (!position) return null;

  const center = () => {
    if (!map) return;
    selectionTap();
    track('map_centered_on_user', {});
    const camera = {
      center: [position.lng, position.lat] as [number, number],
      zoom: Math.max(map.getZoom(), CENTER_ZOOM),
    };
    if (prefersReducedMotion()) map.jumpTo(camera);
    else map.flyTo(camera);
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
