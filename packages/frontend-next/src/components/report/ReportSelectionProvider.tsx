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
  normalizeStationQuery,
  ReportSelectionContext,
  type ReportSelectionContextValue,
} from './ReportSelection.context';

export function ReportSelectionProvider({
  children,
  initialStationId = null,
  initialLineName = null,
}: {
  children: ReactNode;
  initialStationId?: string | null;
  initialLineName?: string | null;
}) {
  const [lineName, setLineName] = useState<string | null>(null);
  const [lineFilter, setLineFilter] = useState<LineFilter>('all');
  const [stationId, setStationId] = useState<string | null>(initialStationId);
  const [stationQuery, setStationQueryState] = useState('');
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
    if (id === null) {
      setLineName(null);
      return;
    }
    // A station served by a single line: pick that line so the user can skip the line step.
    const names = resolveStationLineNames(stations?.[id]?.lines ?? [], lines);
    if (names.length === 1) selectLine(names[0]);
  };

  const selectDirection = (id: string | null) => {
    setDirectionStationId(id);
  };

  // The prefilled station is seeded into stationId above; once the transit data is available,
  // mirror selectStation's single-line shortcut so a station served by exactly one line preselects
  // that line (and its type filter), letting the user skip the line step.
  const [appliedInitialStationId, setAppliedInitialStationId] = useState<string | null>(null);
  if (
    initialStationId &&
    !initialLineName &&
    lines &&
    stations &&
    appliedInitialStationId !== initialStationId
  ) {
    setAppliedInitialStationId(initialStationId);
    const names = resolveStationLineNames(stations[initialStationId]?.lines ?? [], lines);
    if (names.length === 1) {
      setLineName(names[0]);
      const type = lines.find((l) => l.name === names[0])?.type;
      if (type) setLineFilter(type);
    }
  }

  const [appliedInitialLineName, setAppliedInitialLineName] = useState<string | null>(null);
  if (initialLineName && lines && appliedInitialLineName !== initialLineName) {
    setAppliedInitialLineName(initialLineName);
    const initialLine = lines.find((line) => line.name === initialLineName);
    if (initialLine) {
      setLineName(initialLine.name);
      setLineFilter(initialLine.type);
    }
  }

  // One badge per line name (collapses per-direction variants), sorted by canonical order.
  const typeByName = new Map<string, LineType>();
  for (const line of lines ?? []) {
    if (!typeByName.has(line.name)) typeByName.set(line.name, line.type);
  }
  const allLines = [...typeByName].map(([name, type]) => ({ name, type })).sort(compareLineOrder);

  const selectedStation = stationId ? stations?.[stationId] : undefined;

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

  const stationMatchingQuery = (query: string): Station | undefined => {
    const needle = normalizeStationQuery(query.trim());
    if (!needle) return undefined;
    const matches = visibleStations.filter((station) =>
      normalizeStationQuery(station.name).includes(needle),
    );
    return matches.length === 1 ? matches[0] : undefined;
  };

  const previewStation = selectedStation ?? stationMatchingQuery(stationQuery);
  const previewLineNames = previewStation
    ? resolveStationLineNames(previewStation.lines, lines)
    : null;
  const stationLineNames = previewLineNames ? new Set(previewLineNames) : null;
  const visibleLines = allLines
    .filter((l) => lineFilter === 'all' || l.type === lineFilter)
    .filter((l) => !stationLineNames || stationLineNames.has(l.name));
  const activeLineName = lineName ?? (previewLineNames?.length === 1 ? previewLineNames[0] : null);

  const setStationQuery = (query: string) => {
    setStationQueryState(query);
    if (stationId) return;
    const nextId = stationMatchingQuery(query)?.id ?? null;
    const currentId = selectedStation ? null : (stationMatchingQuery(stationQuery)?.id ?? null);
    if (nextId !== currentId) setDirectionStationId(null);
  };

  // Circular lines (e.g. the Ringbahn) loop back on themselves, so picking a terminus as a
  // "direction" is meaningless — leave directionOptions empty so the picker is skipped entirely.
  const selectedLineIsCircular =
    activeLineName !== null && (lines ?? []).some((l) => l.name === activeLineName && l.isCircular);

  // Direction picker exposes every endpoint reachable from the selected station along the
  // chosen line. If the station sits on a single variant we get the two termini of that variant;
  // if it sits on multiple variants (e.g. a branching trunk) we surface every endpoint across
  // those variants, deduplicated. The variant a chosen endpoint belongs to can be resolved at
  // submit time from (lineName, stationId, directionStationId).
  const directionOptions: Station[] = [];
  if (activeLineName && previewStation && !selectedLineIsCircular) {
    const seen = new Set<string>();
    for (const variant of lines ?? []) {
      if (variant.name !== activeLineName) continue;
      if (!variant.stations.includes(previewStation.id)) continue;
      if (variant.stations.length < 2) continue;
      const endpointIds = [variant.stations[0], variant.stations[variant.stations.length - 1]];
      for (const id of endpointIds) {
        if (seen.has(id)) continue;
        const endpoint = stations?.[id];
        if (!endpoint) continue;
        seen.add(id);
        directionOptions.push(endpoint);
      }
    }
  }

  const stationForSubmit = () => {
    if (stationId) return { stationId, lineName: activeLineName, directionStationId };
    const match = stationMatchingQuery(stationQuery);
    if (!match) return null;
    const names = resolveStationLineNames(stations?.[match.id]?.lines ?? [], lines);
    const submittedLine = lineName ?? (names.length === 1 ? names[0] : null);
    const submittedDirection = directionStationId;
    selectStation(match.id);
    return {
      stationId: match.id,
      lineName: submittedLine,
      directionStationId: submittedDirection,
    };
  };

  const value: ReportSelectionContextValue = {
    lineName,
    lineFilter,
    stationId,
    stationQuery,
    directionStationId,
    selectLine,
    setLineFilter,
    selectStation,
    setStationQuery,
    selectDirection,
    stationForSubmit,
    visibleLines,
    visibleStations,
    directionOptions,
    previewStationId: stationId ? null : (previewStation?.id ?? null),
  };

  return <ReportSelectionContext value={value}>{children}</ReportSelectionContext>;
}
