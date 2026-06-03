import { useTranslation } from 'react-i18next';

import { DAY_MS, HOUR_MS, useReports } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { SectionHeading } from '@/components/ui/section-heading';

import { computeLineScores } from './lineScores';
import { LineScoreList } from './LineScoreList';
import { NAMESPACE } from './Reports.i18n';
import { ReportRow } from './ReportRow';

const TOP_LINES_LIMIT = 4;
const RECENT_LIMIT = 6;

export function ReportsSummary() {
  const { t } = useTranslation(NAMESPACE);
  // Top lines summarise the full day; the recent list only shows the still-"live" last hour.
  const { data: dayReports } = useReports(DAY_MS);
  const { data: recentReports } = useReports(HOUR_MS);
  const { data: stations } = useStations();
  const { data: lines } = useLines();

  const lineScores = computeLineScores(dayReports ?? [], stations, lines);
  const topLines = lineScores.slice(0, TOP_LINES_LIMIT);
  // Percentages are shares of all checks in the window, not just the shown top lines.
  const totalLineScore = lineScores.reduce((sum, line) => sum + line.score, 0);
  const recent = (recentReports ?? [])
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, RECENT_LIMIT);

  return (
    <div className="pb-6">
      {topLines.length > 0 && (
        <section>
          <SectionHeading className="px-4 py-3">{t('sectionTopLines')}</SectionHeading>
          <LineScoreList scores={topLines} total={totalLineScore} />
        </section>
      )}

      <section>
        <SectionHeading className="px-4 py-3">{t('sectionRecent')}</SectionHeading>
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
