import type { Report } from '@/api/reports';
import { compareLineOrder, type Line, type LineType } from '@/api/transit';

export type SelectableReportLine = { name: string; type: LineType };

export function getSelectableReportLines(lines: Line[] | undefined): SelectableReportLine[] {
  if (!lines) return [];
  return [...new Map(lines.map((line) => [line.name, line])).values()].sort(compareLineOrder);
}

export function getReportLinesByType(
  lines: SelectableReportLine[],
  lineType: 'all' | LineType,
): SelectableReportLine[] {
  return lines.filter((line) => lineType === 'all' || line.type === lineType);
}

export function filterReportsByLine(
  reports: Report[],
  lines: Line[] | undefined,
  lineName: string | undefined,
): Report[] {
  if (!lineName || !lines) return reports;

  const lineIds = new Set(lines.filter((line) => line.name === lineName).map((line) => line.id));
  const stationIds = new Set(
    lines.filter((line) => line.name === lineName).flatMap((line) => line.stations),
  );

  return reports.filter(
    (report) =>
      (report.lineId !== null && lineIds.has(report.lineId)) ||
      (report.lineId === null && stationIds.has(report.stationId)),
  );
}
