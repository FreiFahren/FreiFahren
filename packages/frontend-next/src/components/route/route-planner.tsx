import { useNavigate } from '@tanstack/react-router';
import { ArrowDown, Crosshair, Route as RouteIcon, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { closestStationId, type Station, useStations } from '@/api/transit';
import { StationPicker } from '@/components/transit/station-picker';
import { Backdrop } from '@/components/ui/backdrop';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { selectionTap } from '@/lib/haptics';
import { Route as JourneyRoute } from '@/routes/_map/route/$fromId/$toId';

import { NAMESPACE } from './route.i18n';

type Field = 'from' | 'to';

export function RoutePlanner() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const { data: stations } = useStations();
  const { position, status, requestLocation } = useGeolocation();

  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [active, setActive] = useState<Field>('to');
  const [query, setQuery] = useState('');
  const toInputRef = useRef<HTMLInputElement>(null);

  const stationList = stations ? Object.values(stations) : [];

  // Focused imperatively rather than with autoFocus, which the a11y rules disallow.
  useEffect(() => {
    if (open) toInputRef.current?.focus();
  }, [open]);

  const nearestStation = (): Station | null => {
    if (!stations || !position) return null;
    const id = closestStationId(stations, position);
    return id ? (stations[id] ?? null) : null;
  };

  const openPlanner = async () => {
    setOpen(true);
    setActive('to');
    setQuery('');
    // Pre-fill the start from the nearest station; the field stays editable either way.
    const known = nearestStation();
    if (known) {
      setFrom(known);
      return;
    }
    const coords = await requestLocation('journey');
    if (coords && stations) {
      const id = closestStationId(stations, { lng: coords.longitude, lat: coords.latitude });
      if (id) setFrom(stations[id] ?? null);
    }
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const select = (station: Station) => {
    selectionTap();
    setQuery('');
    if (active === 'from') {
      setFrom(station);
      setActive('to');
      toInputRef.current?.focus();
      return;
    }
    setTo(station);
    if (from && from.id !== station.id) {
      close();
      navigate({ to: JourneyRoute.to, params: { fromId: from.id, toId: station.id } });
    }
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const sameStation = from !== null && to !== null && from.id === to.id;
  const fieldValue = (field: Field): string => {
    if (active === field) return query;
    const station = field === 'from' ? from : to;
    return station?.name ?? '';
  };

  if (!open) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-16 z-20 px-3">
        <div className="pointer-events-auto mx-auto w-full sm:max-w-md">
          <Button
            variant="secondary"
            className="h-10 gap-2 rounded-lg shadow-sm"
            onClick={() => void openPlanner()}
          >
            <RouteIcon className="size-4" />
            {t('open')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Backdrop aria-label={t('close')} onClose={close} className="z-10 bg-transparent" />
      <div className="pt-safe-3 pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pb-3">
        <div className="pointer-events-auto mx-auto w-full sm:max-w-md">
          <Card className="gap-2 p-2">
            <div className="flex items-center gap-1.5">
              <span aria-hidden className="text-muted-foreground w-4 text-center text-xs">
                ●
              </span>
              <Input
                value={fieldValue('from')}
                onChange={(event) => {
                  setActive('from');
                  setQuery(event.target.value);
                }}
                onFocus={() => {
                  setActive('from');
                  setQuery('');
                }}
                placeholder={status === 'loading' ? t('locating') : t('fromPlaceholder')}
                aria-label={t('from')}
                className="h-9 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('useLocation')}
                onClick={() => void openPlanner()}
              >
                <Crosshair />
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <span aria-hidden className="text-muted-foreground w-4 text-center text-xs">
                ◎
              </span>
              <Input
                ref={toInputRef}
                value={fieldValue('to')}
                onChange={(event) => {
                  setActive('to');
                  setQuery(event.target.value);
                }}
                onFocus={() => {
                  setActive('to');
                  setQuery('');
                }}
                placeholder={t('toPlaceholder')}
                aria-label={t('to')}
                className="h-9 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('swap')}
                onClick={swap}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('close')}
                onClick={close}
              >
                <X />
              </Button>
            </div>

            {sameStation && <p className="px-2 pb-1 text-xs font-medium">{t('sameStation')}</p>}
          </Card>

          {query.trim().length > 0 && (
            <StationPicker
              stations={stationList}
              query={query}
              onSelect={select}
              emptyLabel={t('noResults')}
            />
          )}
        </div>
      </div>
    </>
  );
}
