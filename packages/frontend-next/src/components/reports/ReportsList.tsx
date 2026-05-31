import { useTranslation } from 'react-i18next';

import { DAY_MS, formatElapsed, type Report, useReports } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';

import { NAMESPACE } from './Reports.i18n';

function ReportRow({ report }: { report: Report }) {
  const { t } = useTranslation(NAMESPACE);
  const { data: lines } = useLines();
  const { data: stations } = useStations();

  const lineName = report.lineId
    ? lines?.find((line) => line.id === report.lineId)?.name
    : undefined;
  const stationName = stations?.[report.stationId]?.name;
  const directionName = report.directionId ? stations?.[report.directionId]?.name : undefined;

  return (
    <li className="border-border/60 border-b last:border-b-0">
      <div className="flex flex-col gap-1 px-4 py-3">
        <div className="flex items-center gap-3">
          {lineName && <LineBadge name={lineName} />}
          <span className="flex-1 truncate text-base">{stationName}</span>
          <span className="text-muted-foreground shrink-0 text-sm">
            {formatElapsed(report.timestamp, t)}
          </span>
        </div>
        {directionName && (
          <p className="text-muted-foreground text-sm">{t('direction', { name: directionName })}</p>
        )}
      </div>
    </li>
  );
}

export function ReportsList() {
  const { t } = useTranslation(NAMESPACE);
  const { data: reports } = useReports(DAY_MS);

  const sorted = (reports ?? []).slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div>
      <h2 className="text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
        {t('sectionReports')}
      </h2>
      <ul>
        {sorted.map((report, index) => (
          <ReportRow key={`${report.stationId}-${report.timestamp}-${index}`} report={report} />
        ))}
      </ul>
    </div>
  );
}
