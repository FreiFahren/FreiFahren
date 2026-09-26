import { HOUR_MS, type Report } from '@/api/reports';
import { compareLineOrder, type Line, type Station } from '@/api/transit';

type StationLine = Pick<Line, 'name' | 'type'> & { ids: string[] };

export type StationLineReports = StationLine & {
  reportsInLast24Hours: number;
  reportsInLastHour: number;
};

export type StationLiveData = {
  lineReports: StationLineReports[];
};

function linesByName(lineIds: Iterable<string>, lines: Line[] | undefined): StationLine[] {
  const linesByName = new Map<string, StationLine>();

  for (const lineId of lineIds) {
    const line = lines?.find((candidate) => candidate.id === lineId);
    if (!line) continue;

    const existing = linesByName.get(line.name);
    if (existing) existing.ids.push(line.id);
    else linesByName.set(line.name, { name: line.name, type: line.type, ids: [line.id] });
  }

  return [...linesByName.values()].sort(compareLineOrder);
}

export function lineReportsForIds(
  lineIds: Iterable<string>,
  lines: Line[] | undefined,
  reports: Report[] | undefined,
  now = Date.now(),
): StationLineReports[] {
  const lineReports = linesByName(lineIds, lines).map((line) => ({
    ...line,
    reportsInLast24Hours: 0,
    reportsInLastHour: 0,
  }));
  const lineById = new Map(lineReports.flatMap((line) => line.ids.map((id) => [id, line])));
  const lastHourStart = now - HOUR_MS;

  for (const report of reports ?? []) {
    if (report.isPredicted) continue;

    const line = report.lineId ? lineById.get(report.lineId) : undefined;
    if (!line) continue;

    line.reportsInLast24Hours += 1;
    if (new Date(report.timestamp).getTime() >= lastHourStart) line.reportsInLastHour += 1;
  }

  return lineReports;
}

export function stationLiveData(
  station: Station,
  lines: Line[] | undefined,
  reports: Report[] | undefined,
  now = Date.now(),
): StationLiveData {
  return { lineReports: lineReportsForIds(station.lines, lines, reports, now) };
}

export function sortStationLineReports(lineReports: StationLineReports[]): StationLineReports[] {
  return [...lineReports].sort(
    (a, b) =>
      b.reportsInLastHour - a.reportsInLastHour ||
      b.reportsInLast24Hours - a.reportsInLast24Hours ||
      compareLineOrder(a, b),
  );
}
