import { HOUR_MS, type Report } from '@/api/reports';
import type { RiskData } from '@/api/risk';
import { compareLineOrder, type Line, type Segments, type Station } from '@/api/transit';

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

export function stationRiskFor(
  stationId: string,
  segments: Segments | undefined,
  risk: RiskData | undefined,
): number {
  if (!segments || !risk) return 0;

  let highestRisk = 0;
  for (const segment of segments.features) {
    if (segment.properties.from !== stationId && segment.properties.to !== stationId) continue;
    highestRisk = Math.max(
      highestRisk,
      risk.segments_risk[String(segment.properties.id)]?.risk ?? 0,
    );
  }
  return highestRisk;
}

export function sortStationLineReports(lineReports: StationLineReports[]): StationLineReports[] {
  return [...lineReports].sort(
    (a, b) =>
      b.reportsInLastHour - a.reportsInLastHour ||
      b.reportsInLast24Hours - a.reportsInLast24Hours ||
      compareLineOrder(a, b),
  );
}
