import type { ReportStatistics } from '@/api/statistics';
import { compareLineOrder, type Line, type LineType } from '@/api/transit';

export type LineScore = {
  name: string;
  type: LineType;
  score: number;
  fill: string;
  /** Local hour (0–23) with the most reports, or null when there are none. */
  peakHour: number | null;
};

/** Joins the server's per-line statistics with the line styling the list renders. */
export function toLineScores(
  statistics: ReportStatistics | undefined,
  lines: Line[] | undefined,
): LineScore[] {
  if (!statistics || !lines) return [];

  const lineByName = new Map<string, Line>();
  for (const line of lines) {
    if (!lineByName.has(line.name)) lineByName.set(line.name, line);
  }

  return statistics.lines
    .flatMap((entry) => {
      const line = lineByName.get(entry.name);
      if (!line) return [];
      const peak = Math.max(...entry.hours);
      return [
        {
          name: entry.name,
          type: line.type,
          score: entry.score,
          fill: line.color,
          peakHour: peak > 0 ? entry.hours.indexOf(peak) : null,
        },
      ];
    })
    .sort((a, b) => b.score - a.score || compareLineOrder(a, b));
}
