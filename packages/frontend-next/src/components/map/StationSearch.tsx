import { useNavigate } from '@tanstack/react-router';
import { Search, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type Station, useLines, useStations } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { resolveStationLineNames } from '@/components/transit/displayLines';
import { Backdrop } from '@/components/ui/backdrop';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Route as StationDetailRoute } from '@/routes/stations/$stationId';

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
  const { data: lines } = useLines();
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
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center p-3">
        <div className="pointer-events-auto w-full max-w-md">
          <div className="bg-card text-card-foreground ring-foreground/10 flex h-9 items-center gap-1 rounded-lg pr-1 pl-3 ring-1">
            <Search className="text-muted-foreground size-3 shrink-0" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={t('placeholder')}
              aria-label={t('placeholder')}
              className="h-full flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0 md:text-xs dark:bg-transparent"
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
                <div className="text-muted-foreground px-3 py-4 text-xs">{t('noResults')}</div>
              ) : (
                results.map((station) => {
                  const lineNames = resolveStationLineNames(station.lines, lines);
                  return (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => selectStation(station)}
                      className={cn(
                        'hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 rounded-md px-2 py-2 text-left outline-none',
                      )}
                    >
                      <span className="shrink-0 text-xs">{station.name}</span>
                      <div className="ml-auto flex min-w-0 gap-1 overflow-hidden">
                        {lineNames.map((name) => (
                          <LineBadge key={name} name={name} />
                        ))}
                      </div>
                    </button>
                  );
                })
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
