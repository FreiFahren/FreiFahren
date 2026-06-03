import { useTranslation } from 'react-i18next';

import { DAY_MS, useReports } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { SectionHeading } from '@/components/ui/section-heading';

import { computeLineScores } from './lineScores';
import { LineScoreList } from './LineScoreList';
import { NAMESPACE } from './Reports.i18n';

export function LinesChart() {
  const { t } = useTranslation(NAMESPACE);
  const { data: reports } = useReports(DAY_MS);
  const { data: stations } = useStations();
  const { data: lines } = useLines();

  const data = computeLineScores(reports ?? [], stations, lines);

  if (data.length === 0) {
    return <p className="text-muted-foreground px-4 py-6 text-sm">{t('emptyLines')}</p>;
  }

  return (
    <div>
      <SectionHeading className="px-4 py-3">{t('sectionLines')}</SectionHeading>
      <LineScoreList scores={data} />
    </div>
  );
}
