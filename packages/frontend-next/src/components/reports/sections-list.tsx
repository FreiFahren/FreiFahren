import { useTranslation } from 'react-i18next';

import { useReportStatistics } from '@/api/statistics';
import { SectionHeading } from '@freifahren/ui/section-heading';

import { NAMESPACE } from './Reports.i18n';
import { SectionScoreList } from './section-score-list';
import { useStatisticsPeriod } from './use-statistics-period';

export function SectionsList() {
  const { t } = useTranslation(NAMESPACE);
  const [period] = useStatisticsPeriod();
  const { data: statistics } = useReportStatistics(period);

  const sections = statistics?.sections ?? [];
  if (sections.length === 0) {
    return <p className="text-muted-foreground px-4 py-6 text-sm">{t('emptySections')}</p>;
  }

  return (
    <div>
      <SectionHeading className="px-4 pt-3">
        {t('sectionSections', { period: t(`periodLong.${period}`) })}
      </SectionHeading>
      <p className="text-muted-foreground px-4 pt-1 text-xs">{t('sectionsHint')}</p>
      <SectionScoreList sections={sections} />
    </div>
  );
}
