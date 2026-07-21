import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LineBadge } from '@/components/transit/LineBadge';
import { CardContent } from '@/components/ui/card';
import { track } from '@/lib/analytics';
import { Route as LineDetailRoute } from '@/routes/_map/line/$lineName';

import { NAMESPACE } from './StationDetail.i18n';
import { sortStationLineReports, type StationLineReports } from './station-detail-data';

type StationLineReportsProps = {
  lineReports: StationLineReports[];
};

function LineReportRow({ line }: { line: StationLineReports }) {
  const { t } = useTranslation(NAMESPACE);
  const hasRecentReports = line.reportsInLastHour > 0;

  return (
    <Link
      to={LineDetailRoute.to}
      params={{ lineName: line.name }}
      onClick={() => track('station_line_selected', { line_id: line.name })}
      className="hover:bg-muted/70 focus-visible:ring-ring flex items-center gap-3 px-3 py-2.5 outline-none focus-visible:ring-2"
    >
      <LineBadge name={line.name} className="underline underline-offset-2" />
      <div className="text-muted-foreground text-sm">
        <p>{t('lineReportsLast24Hours', { count: line.reportsInLast24Hours })}</p>
        {hasRecentReports && (
          <p className="text-muted-foreground text-xs">
            {t('inLastHour', { count: line.reportsInLastHour })}
          </p>
        )}
      </div>
      <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0" aria-hidden />
    </Link>
  );
}

export function StationLineReports({ lineReports }: StationLineReportsProps) {
  const { t } = useTranslation(NAMESPACE);
  const rankedLines = sortStationLineReports(lineReports);

  return (
    <CardContent className="space-y-2">
      <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {t('lineReports')}
      </h3>
      <p className="text-muted-foreground text-xs">{t('lineReportsDescription')}</p>
      <div className="divide-border max-h-[30dvh] overflow-y-auto overscroll-contain rounded-md border">
        {rankedLines.map((line) => (
          <LineReportRow key={line.name} line={line} />
        ))}
      </div>
    </CardContent>
  );
}
