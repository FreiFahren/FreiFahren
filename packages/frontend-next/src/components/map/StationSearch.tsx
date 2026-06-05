import { useNavigate } from '@tanstack/react-router';
import { Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type Station, useStations } from '@/api/transit';
import { StationListItem } from '@/components/transit/StationListItem';
import { Backdrop } from '@/components/ui/backdrop';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Route as StationDetailRoute } from '@/routes/_map/stations/$stationId';

import { NAMESPACE } from './StationSearch.i18n';

const MAX_RESULTS = 8;

function matchStations(stations: Station[], query: string): Station[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const results: Station[] = [];
  for (const station of stations) {
    if (station.name.toLowerCase().includes(needle)) {
      results.push(station);
      if (results.length === MAX_RESULTS) break;
    }
  }
  return results;
}

export function StationSearch() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const { data: stations } = useStations();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stationList = stations ? Object.values(stations) : [];
  const results = matchStations(stationList, query);
  const hasQuery = query.length > 0;
  const showResults = query.trim().length > 0;
  const isActive = isFocused || hasQuery;

  const dismiss = () => {
    setQuery('');
    inputRef.current?.blur();
  };

  const selectStation = (station: Station) => {
    setQuery('');
    inputRef.current?.blur();
    navigate({ to: StationDetailRoute.to, params: { stationId: station.id } });
  };

  return (
    <>
      {isActive && (
        <Backdrop aria-label={t('clear')} onClose={dismiss} className="z-10 bg-transparent" />
      )}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 py-3">
        <div className="pointer-events-auto w-full">
          <div className="bg-card text-card-foreground flex h-11 items-center gap-1.5 rounded-lg pr-1 pl-3">
            <Search className="text-muted-foreground size-4 shrink-0" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
              // Stay at 16px so iOS Safari never auto-zooms the page on focus (a sm:text-sm
              // revert would re-trigger the zoom on iPads, which are >=sm but still iOS).
              className="h-full flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            {hasQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setQuery('')}
                aria-label={t('clear')}
              >
                <X />
              </Button>
            )}
          </div>
          {showResults && (
            <Card className="animate-in fade-in slide-in-from-top-2 mt-2 max-h-[60vh] gap-0 overflow-auto p-1 duration-150">
              {results.length === 0 ? (
                <div className="text-muted-foreground px-3 py-4 text-sm">{t('noResults')}</div>
              ) : (
                results.map((station) => (
                  <StationListItem
                    key={station.id}
                    station={station}
                    onClick={() => selectStation(station)}
                  />
                ))
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
