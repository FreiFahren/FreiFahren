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

  const { data: lines } = useLines();
  const { data: stations } = useStations();

  const selectLine = (name: string | null) => {
    setLineName(name);
    if (name) {
      const type = lines?.find((l) => l.name === name)?.type;
      if (type) setLineFilter(type);
    }
  };

  // Clearing the station also clears the chosen line so the user starts fresh.
  const selectStation = (id: string | null) => {
    setStationId(id);
    if (id === null) setLineName(null);
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

  const value: ReportSelectionContextValue = {
    lineName,
    lineFilter,
    stationId,
    selectLine,
    setLineFilter,
    selectStation,
    visibleLines,
    visibleStations,
  };

  return <ReportSelectionContext value={value}>{children}</ReportSelectionContext>;
}
