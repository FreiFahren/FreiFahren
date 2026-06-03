import type { Report } from '@/api/reports';
import { compareLineOrder, type Line, resolveStationLineNames, type Stations } from '@/api/transit';

export type LineScore = { name: string; score: number; fill: string };

/**
 * A report that names a line counts as a full point for that line. A report without a line
 * is spread evenly across every line the station serves — a station on U2 and U3 adds 0.5 to each.
 */
export function computeLineScores(
  reports: Report[],
  stations: Stations | undefined,
  lines: Line[] | undefined,
): LineScore[] {
  const scores = new Map<string, number>();
  const add = (name: string, value: number) => scores.set(name, (scores.get(name) ?? 0) + value);

  for (const report of reports) {
    if (report.lineId) {
      const name = lines?.find((line) => line.id === report.lineId)?.name;
      if (name) add(name, 1);
      continue;
    }

    const stationLines = stations?.[report.stationId]?.lines ?? [];
    const names = resolveStationLineNames(stationLines, lines);
    if (names.length === 0) continue;
    const share = 1 / names.length;
    for (const name of names) add(name, share);
  }

  const colorByName = new Map(lines?.map((line) => [line.name, line.color]));
  return [...scores.entries()]
    .map(([name, score]) => ({
      name,
      score,
      fill: colorByName.get(name) ?? 'var(--color-muted-foreground)',
    }))
    .sort((a, b) => b.score - a.score || compareLineOrder(a, b));
}
