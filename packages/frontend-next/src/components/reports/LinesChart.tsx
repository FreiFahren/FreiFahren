import { useTranslation } from 'react-i18next';

import { useReportStatistics } from '@/api/statistics';
import { useLines } from '@/api/transit';
import { SectionHeading } from '@freifahren/ui/section-heading';

import { toLineScores } from './lineScores';
import { LineScoreList } from './LineScoreList';
import { NAMESPACE } from './Reports.i18n';
import { useStatisticsPeriod } from './use-statistics-period';

export function LinesChart() {
  const { t } = useTranslation(NAMESPACE);
  const [period] = useStatisticsPeriod();
  const { data: statistics } = useReportStatistics(period);
  const { data: lines } = useLines();

  const data = toLineScores(statistics, lines);

  if (data.length === 0) {
    return <p className="text-muted-foreground px-4 py-6 text-sm">{t('emptyLines')}</p>;
  }

  return (
    <div>
      <SectionHeading className="px-4 pt-3">
        {t('sectionLines', { period: t(`periodLong.${period}`) })}
      </SectionHeading>
      <LineScoreList scores={data} showPeakHour />
    </div>
  );
}
