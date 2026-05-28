import { type ReactNode, useState } from 'react';

import {
  compareLineOrder,
  type LineType,
  resolveStationLineNames,
  type Station,
  useLines,
  useStations,
} from '@/api/transit';

import {
  type LineFilter,
  ReportSelectionContext,
  type ReportSelectionContextValue,
} from './ReportSelection.context';

export function ReportSelectionProvider({ children }: { children: ReactNode }) {
  const [lineName, setLineName] = useState<string | null>(null);
  const [lineFilter, setLineFilter] = useState<LineFilter>('all');
  const [stationId, setStationId] = useState<string | null>(null);
  const [directionStationId, setDirectionStationId] = useState<string | null>(null);

  const { data: lines } = useLines();
  const { data: stations } = useStations();

  const selectLine = (name: string | null) => {
    setLineName(name);
    setDirectionStationId(null);
    if (name) {
      const type = lines?.find((l) => l.name === name)?.type;
      if (type) setLineFilter(type);
    }
  };

  // Clearing the station also clears the chosen line so the user starts fresh.
  const selectStation = (id: string | null) => {
    setStationId(id);
    setDirectionStationId(null);
    if (id === null) setLineName(null);
  };

  const selectDirection = (id: string | null) => {
    setDirectionStationId(id);
  };

  // One badge per line name (collapses per-direction variants), sorted by canonical order.
  const typeByName = new Map<string, LineType>();
  for (const line of lines ?? []) {
    if (!typeByName.has(line.name)) typeByName.set(line.name, line.type);
  }
  const allLines = [...typeByName].map(([name, type]) => ({ name, type })).sort(compareLineOrder);

  const selectedStation = stationId ? stations?.[stationId] : undefined;
  const stationLineNames = selectedStation
    ? new Set(resolveStationLineNames(selectedStation.lines, lines))
    : null;
  const visibleLines = allLines
    .filter((l) => lineFilter === 'all' || l.type === lineFilter)
    .filter((l) => !stationLineNames || stationLineNames.has(l.name));

  const stationsAlongLine = () => {
    // Walk every variant of the selected line and emit stations in their stored order,
    // deduplicating across direction variants.
    const seen = new Set<string>();
    const ordered: Station[] = [];
    for (const line of lines ?? []) {
      if (line.name !== lineName) continue;
      for (const id of line.stations) {
        if (seen.has(id)) continue;
        seen.add(id);
        const station = stations?.[id];
        if (station) ordered.push(station);
      }
    }
    return ordered;
  };

  const stationsByType = () =>
    Object.values(stations ?? {})
      .filter((station) => {
        if (lineFilter === 'all') return true;
        const names = resolveStationLineNames(station.lines, lines);
        return names.some((name) => typeByName.get(name) === lineFilter);
      })
      .sort((a, b) => a.name.localeCompare(b.name));

  let visibleStations: Station[];
  if (selectedStation) visibleStations = [selectedStation];
  else if (lineName) visibleStations = stationsAlongLine();
  else visibleStations = stationsByType();

  // Direction picker shows the two endpoint stations of the selected line.
  // For lines with multiple direction variants (U1, U1-a, U1-b …) pick the canonical "-a" variant
  // and fall back to the only variant when there is just one.
  const directionOptions: Station[] = [];
  if (lineName && selectedStation) {
    const variants = (lines ?? []).filter((l) => l.name === lineName);
    const variant = variants.find((l) => l.id.endsWith('-a')) ?? variants[0];
    if (variant && variant.stations.length >= 2) {
      const first = stations?.[variant.stations[0]];
      const last = stations?.[variant.stations[variant.stations.length - 1]];
      if (first) directionOptions.push(first);
      if (last && last.id !== first?.id) directionOptions.push(last);
    }
  }

  const value: ReportSelectionContextValue = {
    lineName,
    lineFilter,
    stationId,
    directionStationId,
    selectLine,
    setLineFilter,
    selectStation,
    selectDirection,
    visibleLines,
    visibleStations,
    directionOptions,
  };

  return <ReportSelectionContext value={value}>{children}</ReportSelectionContext>;
}
