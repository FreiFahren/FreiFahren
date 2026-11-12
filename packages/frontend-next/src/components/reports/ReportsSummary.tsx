import { useTranslation } from 'react-i18next';

import { HOUR_MS, useReports } from '@/api/reports';
import { useReportStatistics } from '@/api/statistics';
import { useLines } from '@/api/transit';
import { SectionHeading } from '@freifahren/ui/section-heading';

import { toLineScores } from './lineScores';
import { LineScoreList } from './LineScoreList';
import { NAMESPACE } from './Reports.i18n';
import { ReportRow } from './ReportRow';
import { useStatisticsPeriod } from './use-statistics-period';

const TOP_LINES_LIMIT = 4;
const RECENT_LIMIT = 6;

export function ReportsSummary() {
  const { t } = useTranslation(NAMESPACE);
  // Top lines follow the selected period; the recent list only shows the still-"live" last hour.
  const [period] = useStatisticsPeriod();
  const { data: statistics } = useReportStatistics(period);
  const { data: recentReports } = useReports(HOUR_MS);
  const { data: lines } = useLines();

  const lineScores = toLineScores(statistics, lines);
  const topLines = lineScores.slice(0, TOP_LINES_LIMIT);
  // Percentages are shares of all checks in the period, not just the shown top lines.
  const totalLineScore = lineScores.reduce((sum, line) => sum + line.score, 0);
  const recent = (recentReports ?? [])
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, RECENT_LIMIT);

  return (
    <div className="pb-6">
      {topLines.length > 0 && (
        <section>
          <SectionHeading className="px-4 pt-3">
            {t('sectionTopLines', { period: t(`periodLong.${period}`) })}
          </SectionHeading>
          <LineScoreList scores={topLines} total={totalLineScore} />
        </section>
      )}

      <section>
        <SectionHeading className="px-4 pt-3">{t('sectionRecent')}</SectionHeading>
        {recent.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-sm">{t('emptyRecent')}</p>
        ) : (
          <ul>
            {recent.map((report, index) => (
              <ReportRow
                key={`${report.stationId}-${report.timestamp}-${index}`}
                report={report}
                recent
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
