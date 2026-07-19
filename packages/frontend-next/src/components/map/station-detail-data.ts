import { HOUR_MS, type Report } from '@/api/reports';
import { compareLineOrder, type Line, type Station } from '@/api/transit';

type StationLine = Pick<Line, 'name' | 'type'> & { ids: string[] };

export type StationLineReports = StationLine & {
  reportsInLast24Hours: number;
  reportsInLastHour: number;
};

export type StationLiveData = {
  stationReportCount: number;
  lineReports: StationLineReports[];
};

function stationLinesByName(station: Station, lines: Line[] | undefined): StationLine[] {
  const linesByName = new Map<string, StationLine>();

  for (const lineId of station.lines) {
    const line = lines?.find((candidate) => candidate.id === lineId);
    if (!line) continue;

    const existing = linesByName.get(line.name);
    if (existing) existing.ids.push(line.id);
    else linesByName.set(line.name, { name: line.name, type: line.type, ids: [line.id] });
  }

  return [...linesByName.values()].sort(compareLineOrder);
}

export function stationLiveData(
  station: Station,
  lines: Line[] | undefined,
  reports: Report[] | undefined,
  now = Date.now(),
): StationLiveData {
  const lineReports = stationLinesByName(station, lines).map((line) => ({
    ...line,
    reportsInLast24Hours: 0,
    reportsInLastHour: 0,
  }));
  const lineById = new Map(lineReports.flatMap((line) => line.ids.map((id) => [id, line])));
  const lastHourStart = now - HOUR_MS;
  let stationReportCount = 0;

  for (const report of reports ?? []) {
    if (report.stationId === station.id) stationReportCount += 1;

    const line = report.lineId ? lineById.get(report.lineId) : undefined;
    if (!line) continue;

    line.reportsInLast24Hours += 1;
    if (new Date(report.timestamp).getTime() >= lastHourStart) line.reportsInLastHour += 1;
  }

  return { stationReportCount, lineReports };
}

export function sortStationLineReports(lineReports: StationLineReports[]): StationLineReports[] {
  return [...lineReports].sort(
    (a, b) =>
      b.reportsInLastHour - a.reportsInLastHour ||
      b.reportsInLast24Hours - a.reportsInLast24Hours ||
      compareLineOrder(a, b),
  );
}
