import { useNavigate } from '@tanstack/react-router';
import { ChevronRight, Search, X } from 'lucide-react';
import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  compareLineOrder,
  type Line,
  type Station,
  type Stations,
  useLines,
  useStations,
} from '@/api/transit';
import { track } from '@/lib/analytics';
import { selectionTap } from '@/lib/haptics';
import { LineBadge } from '@/components/transit/LineBadge';
import { StationListItem } from '@/components/transit/StationListItem';
import { Backdrop } from '@/components/ui/backdrop';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Route as LineDetailRoute } from '@/routes/_map/line/$lineName';
import { Route as StationDetailRoute } from '@/routes/_map/station/$stationId';

import { NAMESPACE } from './StationSearch.i18n';

const MAX_RESULTS = 8;
// Lines are listed above stations, so cap them to keep short queries like "u" from crowding
// every station out of the list.
const MAX_LINE_RESULTS = 3;

function matchStations(stations: Station[], query: string, limit: number): Station[] {
  const needle = query.trim().toLowerCase();
  if (!needle || limit <= 0) return [];
  const results: Station[] = [];
  for (const station of stations) {
    if (station.name.toLowerCase().includes(needle)) {
      results.push(station);
      if (results.length === limit) break;
    }
  }
  return results;
}

// One result per displayed line name: directional variants share a name, and the line route is
// keyed by that name. The longest variant (ties broken by id) supplies the termini.
function matchLines(lines: Line[], query: string): Line[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const byName = new Map<string, Line>();
  for (const line of lines) {
    if (!line.name.toLowerCase().includes(needle)) continue;
    const current = byName.get(line.name);
    if (
      !current ||
      line.stations.length > current.stations.length ||
      (line.stations.length === current.stations.length && line.id < current.id)
    ) {
      byName.set(line.name, line);
    }
  }
  const rank = (line: Line) => {
    const name = line.name.toLowerCase();
    if (name === needle) return 0;
    return name.startsWith(needle) ? 1 : 2;
  };
  return [...byName.values()]
    .sort((a, b) => rank(a) - rank(b) || compareLineOrder(a, b) || a.name.localeCompare(b.name))
    .slice(0, MAX_LINE_RESULTS);
}

function LineResult({
  line,
  stations,
  onClick,
}: {
  line: Line;
  stations: Stations | undefined;
  onClick: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  const first = stations?.[line.stations[0]!]?.name;
  const last = stations?.[line.stations.at(-1)!]?.name;
  const termini = line.isCircular ? t('circularLine') : first && last ? `${first} ↔ ${last}` : '';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={termini ? `${t('openLine', { name: line.name })}: ${termini}` : undefined}
      className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left outline-none"
    >
      <LineBadge name={line.name} className="shrink-0" />
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
        {termini || t('openLine', { name: line.name })}
      </span>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </button>
  );
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
  const lineResults = matchLines(lines ?? [], query);
  const stationResults = matchStations(stationList, query, MAX_RESULTS - lineResults.length);
  const hasQuery = query.length > 0;
  const showResults = query.trim().length > 0;
  const isActive = isFocused || hasQuery;

  const dismiss = () => {
    setQuery('');
    inputRef.current?.blur();
  };

  // The backdrop sits over the map while the search is open, so a tap on it already dismisses
  // (via onClose). Also dismiss when the user starts panning (pointer move with a button/finger
  // down) or zooming (wheel) the map underneath, so map gestures close the search too.
  const dismissOnPan = (event: ReactPointerEvent) => {
    if (event.buttons !== 0) dismiss();
  };

  const selectStation = (station: Station) => {
    setQuery('');
    inputRef.current?.blur();
    track('station_selected', { source: 'search' });
    selectionTap();
    navigate({ to: StationDetailRoute.to, params: { stationId: station.id } });
  };

  // LineDetail records the selection itself as line_detail_opened with source 'search'.
  const selectLine = (line: Line) => {
    setQuery('');
    inputRef.current?.blur();
    selectionTap();
    navigate({
      to: LineDetailRoute.to,
      params: { lineName: line.name },
      search: { source: 'search' },
    });
  };

  return (
    <>
      {isActive && (
        <Backdrop
          aria-label={t('clear')}
          onClose={dismiss}
          onPointerMove={dismissOnPan}
          onWheel={dismiss}
          className="z-10 bg-transparent"
        />
      )}
      <div className="pt-safe-3 pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pb-3">
        <div className="pointer-events-auto mx-auto w-full sm:max-w-md">
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
              {lineResults.length === 0 && stationResults.length === 0 ? (
                <div className="text-muted-foreground px-3 py-4 text-sm">{t('noResults')}</div>
              ) : (
                <>
                  {lineResults.map((line) => (
                    <LineResult
                      key={line.name}
                      line={line}
                      stations={stations}
                      onClick={() => selectLine(line)}
                    />
                  ))}
                  {stationResults.map((station) => (
                    <StationListItem
                      key={station.id}
                      station={station}
                      onClick={() => selectStation(station)}
                    />
                  ))}
                </>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
