import { useTranslation } from 'react-i18next';

import { LineBadge } from '@/components/transit/LineBadge';
import { CardContent } from '@/components/ui/card';

import { NAMESPACE } from './StationDetail.i18n';
import { sortStationLineReports, type StationLineReports } from './station-detail-data';

type StationLineReportsProps = {
  stationReportCount: number;
  lineReports: StationLineReports[];
};

function LineReportRow({ line }: { line: StationLineReports }) {
  const { t } = useTranslation(NAMESPACE);
  const hasRecentReports = line.reportsInLastHour > 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <LineBadge name={line.name} />
      <div className="text-muted-foreground text-sm">
        <p>{t('lineReportsLast24Hours', { count: line.reportsInLast24Hours })}</p>
        {hasRecentReports && (
          <p className="text-muted-foreground text-xs">
            {t('inLastHour', { count: line.reportsInLastHour })}
          </p>
        )}
      </div>
    </div>
  );
}

export function StationLineReports({ stationReportCount, lineReports }: StationLineReportsProps) {
  const { t } = useTranslation(NAMESPACE);
  const rankedLines = sortStationLineReports(lineReports);

  return (
    <CardContent className="space-y-2">
      <p className="text-muted-foreground text-sm">
        {t('stationReportsLast24Hours', { count: stationReportCount })}
      </p>
      <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {t('lineReports')}
      </h3>
      <div className="divide-border max-h-[30dvh] overflow-y-auto overscroll-contain rounded-md border">
        {rankedLines.map((line) => (
          <LineReportRow key={line.name} line={line} />
        ))}
      </div>
    </CardContent>
  );
}
