import { useTranslation } from 'react-i18next';

import { DAY_MS, type Report, useReports } from '@/api/reports';
import {
  compareLineOrder,
  type Line,
  resolveStationLineNames,
  type Stations,
  useLines,
  useStations,
} from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';

import { NAMESPACE } from './Reports.i18n';

type LineScore = { name: string; score: number; fill: string };

/**
 * A report that names a line counts as a full point for that line. A report without a line
 * is spread evenly across every line the station serves — a station on U2 and U3 adds 0.5 to each.
 */
function computeLineScores(
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

export function LinesChart() {
  const { t } = useTranslation(NAMESPACE);
  const { data: reports } = useReports(DAY_MS);
  const { data: stations } = useStations();
  const { data: lines } = useLines();

  const data = computeLineScores(reports ?? [], stations, lines);

  if (data.length === 0) {
    return <p className="text-muted-foreground px-4 py-6 text-sm">{t('emptyLines')}</p>;
  }

  // The most-checked line fills the full bar width; every other line scales against it.
  const maxScore = Math.max(...data.map((entry) => entry.score));
  const totalScore = data.reduce((sum, entry) => sum + entry.score, 0);

  return (
    <div>
      <h2 className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
        {t('sectionLines')}
      </h2>
      <ul>
        {data.map((entry) => {
          const percent = totalScore > 0 ? Math.round((entry.score / totalScore) * 100) : 0;
          const width = maxScore > 0 ? (entry.score / maxScore) * 100 : 0;
          return (
            <li key={entry.name} className="flex h-14 items-center gap-3 px-4">
              <LineBadge name={entry.name} />
              <div className="h-2.5 flex-1">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${width}%`, backgroundColor: entry.fill }}
                />
              </div>
              <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums">
                {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
