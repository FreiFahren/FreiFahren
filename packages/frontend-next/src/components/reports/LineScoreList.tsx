import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LineBadge } from '@/components/transit/LineBadge';
import { track } from '@/lib/analytics';
import { Route as StationsRoute } from '@/routes/reports/stations';

import type { LineScore } from './lineScores';
import { NAMESPACE } from './Reports.i18n';

type LineScoreListProps = {
  scores: LineScore[];
  /**
   * Denominator for the percentage column. Defaults to the sum of `scores`; pass the full
   * day's total when `scores` is only a top-N slice so the percentages stay true shares.
   */
  total?: number;
  /** Show each line's busiest hour of day under its bar. */
  showPeakHour?: boolean;
};

export function LineScoreList({ scores, total, showPeakHour = false }: LineScoreListProps) {
  const { t } = useTranslation(NAMESPACE);
  // The most-checked line fills the full bar width; every other line scales against it.
  const maxScore = Math.max(...scores.map((entry) => entry.score), 0);
  const denominator = total ?? scores.reduce((sum, entry) => sum + entry.score, 0);

  return (
    <ul>
      {scores.map((entry) => {
        const percent = denominator > 0 ? Math.round((entry.score / denominator) * 100) : 0;
        const width = maxScore > 0 ? (entry.score / maxScore) * 100 : 0;
        return (
          <li key={entry.name}>
            <Link
              to={StationsRoute.to}
              search={{ lineName: entry.name }}
              onClick={() => {
                track('reports_line_filter_used', {
                  action: 'selected',
                  line_id: entry.name,
                  line_type: entry.type,
                });
              }}
              className="hover:bg-muted/70 focus-visible:ring-ring flex h-14 items-center gap-3 px-4 outline-none focus-visible:ring-2"
            >
              <LineBadge name={entry.name} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: entry.fill }}
                  />
                </div>
                {showPeakHour && entry.peakHour !== null && (
                  <span className="text-muted-foreground text-xs">
                    {t('peakHour', { hour: String(entry.peakHour).padStart(2, '0') })}
                  </span>
                )}
              </div>
              <span className="w-9 shrink-0 text-right text-sm font-semibold tabular-nums">
                {percent}%
              </span>
              <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
