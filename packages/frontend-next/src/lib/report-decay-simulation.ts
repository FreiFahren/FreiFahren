import type { Report } from '@/api/reports';
import type { Line, Stations } from '@/api/transit';

import { AVG_HOP_TRAVEL_MS, BURST_WINDOW_MS } from './report-decay';

export const FALLBACK_LINES: Line[] = [
  {
    id: 'debug-line-a',
    name: 'A',
    type: 'subway',
    isCircular: false,
    color: '#d63b3b',
    stations: [
      'debug-a0',
      'debug-a1',
      'debug-a2',
      'debug-a3',
      'debug-shared',
      'debug-a4',
      'debug-a5',
      'debug-a6',
    ],
  },
  {
    id: 'debug-line-b',
    name: 'B',
    type: 'subway',
    isCircular: false,
    color: '#3b82f6',
    stations: ['debug-b0', 'debug-b1', 'debug-shared', 'debug-b2', 'debug-b3', 'debug-b4'],
  },
];

export const FALLBACK_STATIONS: Stations = Object.fromEntries(
  FALLBACK_LINES.flatMap((line) =>
    line.stations.map((stationId, index) => [
      stationId,
      {
        id: stationId,
        name:
          stationId === 'debug-shared' ? 'Umsteigebahnhof' : `${line.name}-Station ${index + 1}`,
        coordinates: { latitude: 52.5 + index * 0.003, longitude: 13.4 + index * 0.003 },
        lines: FALLBACK_LINES.filter((l) => l.stations.includes(stationId)).map((l) => l.id),
      },
    ]),
  ),
);

export function buildBurstReports(
  stations: Stations,
  count: number,
  nowMs: number,
  windowMs: number = BURST_WINDOW_MS,
): Report[] {
  const stationIds = Object.keys(stations);
  if (stationIds.length === 0) return [];

  const reports: Report[] = [];
  for (let i = 0; i < count; i++) {
    const stationId = stationIds[Math.floor(Math.random() * stationIds.length)]!;
    const offsetMs = Math.random() * windowMs;
    reports.push({
      stationId,
      lineId: null,
      directionId: null,
      timestamp: new Date(nowMs - offsetMs).toISOString(),
      isPredicted: false,
    });
  }
  return reports;
}

export type ControllerWalkOptions = {
  lines: Line[];
  stations: Stations;
  startLineId: string;
  startMs: number;
  hopCount: number;
  hopMs?: number;
  allowLineSwitch: boolean;
};

export function buildControllerWalk({
  lines,
  stations,
  startLineId,
  startMs,
  hopCount,
  hopMs = AVG_HOP_TRAVEL_MS,
  allowLineSwitch,
}: ControllerWalkOptions): Report[] {
  const lineById = new Map(lines.map((line) => [line.id, line]));
  const startLine = lineById.get(startLineId);
  if (!startLine) return [];
  let currentLine: Line = startLine;

  const reports: Report[] = [];
  let cursor = currentLine.stations.length > 0 ? 0 : -1;
  let switched = false;
  let timestampMs = startMs;

  for (let hop = 0; hop < hopCount && cursor >= 0 && cursor < currentLine.stations.length; hop++) {
    const stationId = currentLine.stations[cursor]!;
    const lastStationId = currentLine.stations[currentLine.stations.length - 1] ?? null;
    reports.push({
      stationId,
      lineId: currentLine.id,
      directionId: lastStationId,
      timestamp: new Date(timestampMs).toISOString(),
      isPredicted: false,
    });

    if (allowLineSwitch && !switched && hop === Math.floor(hopCount / 2)) {
      const station = stations[stationId];
      const alternativeLineId = station?.lines.find((id) => {
        const candidate = lineById.get(id);
        return candidate && candidate.name !== currentLine.name;
      });
      const alternativeLine = alternativeLineId ? lineById.get(alternativeLineId) : undefined;
      const alternativeCursor = alternativeLine?.stations.indexOf(stationId) ?? -1;
      if (alternativeLine && alternativeCursor !== -1) {
        currentLine = alternativeLine;
        cursor = alternativeCursor;
        switched = true;
        timestampMs += hopMs;
        continue;
      }
    }

    cursor++;
    timestampMs += hopMs;
  }

  return reports;
}
