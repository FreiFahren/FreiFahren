import { type ReactNode, useMemo, useState } from 'react';

import {
  compareLineOrder,
  type Line,
  type LineType,
  resolveStationLineNames,
  type Station,
  useLines,
  useStations,
} from '@/api/transit';

import {
  type LineFilter,
  normalizedStationName,
  normalizeStationQuery,
  ReportSelectionContext,
  type ReportSelectionContextValue,
} from './ReportSelection.context';

type StationMap = Record<string, Station> | undefined;

// Every variant of the line, in stored order, deduplicated across direction variants.
function stationsAlongLine(lines: Line[] | undefined, stations: StationMap, lineName: string) {
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
}

function stationsByType(lines: Line[] | undefined, stations: StationMap, lineFilter: LineFilter) {
  const typeByName = new Map<string, LineType>();
  for (const line of lines ?? []) {
    if (!typeByName.has(line.name)) typeByName.set(line.name, line.type);
  }
  return Object.values(stations ?? {})
    .filter(
      (station) =>
        lineFilter === 'all' ||
        resolveStationLineNames(station.lines, lines).some(
          (name) => typeByName.get(name) === lineFilter,
        ),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

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
  const [tappedStationId, setTappedStationId] = useState<string | null>(initialStationId);
  const [stationQuery, setStationQuery] = useState('');
  const [directionStationIdState, setDirectionStationId] = useState<string | null>(null);

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
    setTappedStationId(id);
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

  // The prefilled station is seeded into tappedStationId above; once the transit data is available,
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

  // Rebuilding and re-sorting ~1k stations on every keystroke is noticeable on slow phones.
  const matchPool = useMemo(
    () =>
      lineName
        ? stationsAlongLine(lines, stations, lineName)
        : stationsByType(lines, stations, lineFilter),
    [lines, stations, lineName, lineFilter],
  );

  const uniqueMatch = (() => {
    if (tappedStationId !== null) return undefined;
    const needle = normalizeStationQuery(stationQuery.trim());
    if (!needle) return undefined;
    const matches = matchPool.filter((station) => normalizedStationName(station).includes(needle));
    return matches.length === 1 ? matches[0] : undefined;
  })();

  const stationId = tappedStationId ?? uniqueMatch?.id ?? null;
  const derivedStation = stationId ? stations?.[stationId] : undefined;
  const visibleStations = tappedStationId !== null && derivedStation ? [derivedStation] : matchPool;

  const derivedLineNames = derivedStation
    ? resolveStationLineNames(derivedStation.lines, lines)
    : null;
  const visibleLines = allLines
    .filter((l) => lineFilter === 'all' || l.type === lineFilter)
    .filter((l) => !derivedLineNames || derivedLineNames.includes(l.name));
  const activeLineName = lineName ?? (derivedLineNames?.length === 1 ? derivedLineNames[0] : null);

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
  if (activeLineName && derivedStation && !selectedLineIsCircular) {
    const seen = new Set<string>();
    for (const variant of lines ?? []) {
      if (variant.name !== activeLineName) continue;
      if (!variant.stations.includes(derivedStation.id)) continue;
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

  const directionStationId = directionOptions.some((s) => s.id === directionStationIdState)
    ? directionStationIdState
    : null;

  const stationForSubmit = () => {
    if (stationId === null) return null;
    return { stationId, lineName: activeLineName, directionStationId };
  };

  const value: ReportSelectionContextValue = {
    lineName,
    activeLineName,
    lineFilter,
    stationId,
    tappedStationId,
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
  };

  return <ReportSelectionContext value={value}>{children}</ReportSelectionContext>;
}
