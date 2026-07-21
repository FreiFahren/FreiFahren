import { Link } from '@tanstack/react-router';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { LineInsights } from '@/api/insights';
import type { Stations } from '@/api/transit';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { Route as StationDetailRoute } from '@/routes/_map/station/$stationId';

import { NAMESPACE } from './LineDetail.i18n';

type HotspotStation = LineInsights['hotspots']['stations'][number];
type QuietGroup = { id: string; stations: HotspotStation[] };
type ListEntry =
  | { kind: 'hotspot'; station: HotspotStation }
  | { kind: 'quiet'; group: QuietGroup };

type HotspotListProps = {
  lineName: string;
  color: string;
  hotspots: LineInsights['hotspots']['stations'];
  stationOrder: string[];
  stationData: Stations | undefined;
  emptyLabel: string;
};

const MIN_HOTSPOT_SHARE = 0.06;
const ABOVE_UNIFORM_FACTOR = 1.5;

function orderedStations(
  stationOrder: string[],
  stationData: Stations | undefined,
  hotspots: HotspotStation[],
): HotspotStation[] {
  const metricsById = new Map(hotspots.map((station) => [station.stationId, station]));
  return stationOrder.flatMap((stationId) => {
    const metric = metricsById.get(stationId);
    if (!metric || metric.value === 0) return [];
    return [{ ...metric, name: stationData?.[stationId]?.name ?? metric.name }];
  });
}

function formatShare(share: number): string {
  if (share > 0 && share < 0.01) return '<1%';
  return `${Math.round(share * 100)}%`;
}

function routeEntries(stations: HotspotStation[]): ListEntry[] {
  if (stations.length === 0) return [];
  const largest = Math.max(...stations.map((station) => station.share));
  const threshold = Math.max(MIN_HOTSPOT_SHARE, (1 / stations.length) * ABOVE_UNIFORM_FACTOR);
  const entries: ListEntry[] = [];
  let quietStations: HotspotStation[] = [];

  const flushQuietStations = () => {
    if (quietStations.length === 0) return;
    entries.push({
      kind: 'quiet',
      group: {
        id: `${quietStations[0]!.stationId}-${quietStations.at(-1)!.stationId}`,
        stations: quietStations,
      },
    });
    quietStations = [];
  };

  for (const station of stations) {
    const isHotspot =
      station.share > 0 && (station.share === largest || station.share >= threshold);
    if (!isHotspot) {
      quietStations.push(station);
      continue;
    }
    flushQuietStations();
    entries.push({ kind: 'hotspot', station });
  }
  flushQuietStations();
  return entries;
}

function StationActivity({
  station,
  largestShare,
  compact = false,
}: {
  station: HotspotStation;
  largestShare: number;
  compact?: boolean;
}) {
  const percentage = formatShare(station.share);
  return (
    <>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{station.name}</span>
      <span
        aria-hidden="true"
        className={cn('bg-muted h-3 overflow-hidden rounded-full', compact ? 'w-16' : 'w-24')}
      >
        <span
          className={cn(
            'block h-full rounded-full',
            station.share === largestShare ? 'bg-accent-bright' : 'bg-muted-foreground/65',
          )}
          style={{ width: `${Math.max(4, station.share * 100)}%` }}
        />
      </span>
      <span className="text-muted-foreground w-8 text-right text-sm font-semibold">
        {percentage}
      </span>
    </>
  );
}

function StationLink({
  lineName,
  station,
  largestShare,
  compact = false,
}: {
  lineName: string;
  station: HotspotStation;
  largestShare: number;
  compact?: boolean;
}) {
  return (
    <Link
      to={StationDetailRoute.to}
      params={{ stationId: station.stationId }}
      onClick={() =>
        track('line_hotspot_selected', { line_id: lineName, station_id: station.stationId })
      }
      className="hover:bg-muted/70 focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-sm py-1 outline-none focus-visible:ring-2"
    >
      <StationActivity station={station} largestShare={largestShare} compact={compact} />
    </Link>
  );
}

export function HotspotList({
  lineName,
  color,
  hotspots,
  stationOrder,
  stationData,
  emptyLabel,
}: HotspotListProps) {
  const { t } = useTranslation(NAMESPACE);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const stations = orderedStations(stationOrder, stationData, hotspots);
  if (stations.length === 0) return <p className="text-muted-foreground text-sm">{emptyLabel}</p>;
  const entries = routeEntries(stations);
  const largestShare = Math.max(...stations.map((station) => station.share));

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  return (
    <ol className="relative space-y-1">
      <div
        aria-hidden="true"
        className="absolute top-3 bottom-3 left-[5px] w-0.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {entries.map((entry) => {
        if (entry.kind === 'hotspot') {
          return (
            <li
              key={entry.station.stationId}
              className="relative grid grid-cols-[12px_minmax(0,1fr)] gap-3"
            >
              <span
                aria-hidden="true"
                className="border-card z-10 mt-2 size-3 rounded-full border-[3px]"
                style={{ backgroundColor: color }}
              />
              <StationLink
                lineName={lineName}
                station={entry.station}
                largestShare={largestShare}
              />
            </li>
          );
        }

        const { group } = entry;
        const isExpanded = expandedGroups.has(group.id);
        const groupShare = formatShare(
          group.stations.reduce((sum, station) => sum + station.share, 0),
        );
        return (
          <li key={group.id} className="relative">
            <div className="grid grid-cols-[12px_minmax(0,1fr)] gap-3">
              <span
                aria-hidden="true"
                className="border-card z-10 mt-2 size-3 rounded-full border-[3px] opacity-70"
                style={{ backgroundColor: color }}
              />
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleGroup(group.id)}
                className="hover:bg-muted/70 focus-visible:ring-ring text-muted-foreground flex min-w-0 items-center gap-2 rounded-sm py-1 text-left text-sm outline-none focus-visible:ring-2"
              >
                <span className="min-w-0 flex-1 truncate">
                  {t('quieterStations', { count: group.stations.length })}
                </span>
                <span className="text-xs font-semibold">{groupShare}</span>
                <ChevronDown
                  className={cn('size-4 shrink-0 transition-transform', isExpanded && 'rotate-180')}
                />
              </button>
            </div>
            {isExpanded && (
              <ol className="border-border-soft mt-1 ml-6 space-y-1 border-l pl-3">
                {group.stations.map((station) => (
                  <li key={station.stationId}>
                    <StationLink
                      lineName={lineName}
                      station={station}
                      largestShare={largestShare}
                      compact
                    />
                  </li>
                ))}
              </ol>
            )}
          </li>
        );
      })}
    </ol>
  );
}
