import { LineBadge } from '@/components/transit/LineBadge';

import type { LineScore } from './lineScores';

type LineScoreListProps = {
  scores: LineScore[];
  /**
   * Denominator for the percentage column. Defaults to the sum of `scores`; pass the full
   * day's total when `scores` is only a top-N slice so the percentages stay true shares.
   */
  total?: number;
};

export function LineScoreList({ scores, total }: LineScoreListProps) {
  // The most-checked line fills the full bar width; every other line scales against it.
  const maxScore = Math.max(...scores.map((entry) => entry.score), 0);
  const denominator = total ?? scores.reduce((sum, entry) => sum + entry.score, 0);

  return (
    <ul>
      {scores.map((entry) => {
        const percent = denominator > 0 ? Math.round((entry.score / denominator) * 100) : 0;
        const width = maxScore > 0 ? (entry.score / maxScore) * 100 : 0;
        return (
          <li key={entry.name} className="flex h-14 items-center gap-3 px-4">
            <LineBadge name={entry.name} />
            <div className="bg-muted h-2.5 flex-1 overflow-hidden rounded-full">
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
  );
}
