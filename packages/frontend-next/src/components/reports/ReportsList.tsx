import { useTranslation } from 'react-i18next';

import { DAY_MS, HOUR_MS, useReports } from '@/api/reports';
import { SectionHeading } from '@/components/ui/section-heading';

import { NAMESPACE } from './Reports.i18n';
import { ReportRow } from './ReportRow';

export function ReportsList() {
  const { t } = useTranslation(NAMESPACE);
  const { data: reports } = useReports(DAY_MS);
  // A report is "recent" if it falls in the last-hour window (shares the cache, no extra fetch).
  const { data: recentReports } = useReports(HOUR_MS);
  const recentKeys = new Set(
    (recentReports ?? []).map((report) => `${report.stationId}-${report.timestamp}`),
  );

  const sorted = (reports ?? []).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div>
      <SectionHeading className="px-4 py-3">{t('sectionReports')}</SectionHeading>
      <ul>
        {sorted.map((report, index) => {
          const key = `${report.stationId}-${report.timestamp}`;
          return <ReportRow key={`${key}-${index}`} report={report} recent={recentKeys.has(key)} />;
        })}
      </ul>
    </div>
  );
}
