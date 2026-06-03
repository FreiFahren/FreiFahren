import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { HOUR_MS, useReports } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { Route as ReportsSummaryRoute } from '@/routes/reports/index';

import { NAMESPACE } from './ReportsOverviewButton.i18n';

export function ReportsOverviewButton() {
  const { t } = useTranslation(NAMESPACE);
  const { data: reports } = useReports(HOUR_MS);
  const { data: lines } = useLines();
  const { data: stations } = useStations();

  // useReports(HOUR_MS) already scopes the data to the last hour, so the count is just the
  // number of reports and the latest is the newest by timestamp.
  const allReports = reports ?? [];
  const recentCount = allReports.length;
  const latest = allReports.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  if (!latest) return null;

  const lineName = latest.lineId
    ? lines?.find((line) => line.id === latest.lineId)?.name
    : undefined;
  const stationName = stations?.[latest.stationId]?.name;

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 z-20 p-3">
      <Button
        asChild
        variant="secondary"
        className="bg-card text-card-foreground ring-foreground/10 hover:bg-card/80 pointer-events-auto h-auto w-full max-w-[min(20rem,calc(100vw-10.5rem))] flex-col items-stretch gap-1.5 rounded-lg px-3.5 py-3 shadow-[0_6px_16px_rgba(0,0,0,0.28)] ring-1"
      >
        <Link to={ReportsSummaryRoute.to}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-xs">{t('lastHour')}</span>
            <span className="text-sm font-semibold">{recentCount}</span>
          </div>
          <div className="flex items-center gap-2">
            {lineName && <LineBadge name={lineName} />}
            <span className="flex-1 truncate text-sm font-medium">{stationName}</span>
            <span className="relative ml-auto block size-2 shrink-0">
              <span className="bg-destructive absolute inset-0 animate-ping rounded-full opacity-75" />
              <span className="bg-destructive relative block size-2 rounded-full" />
            </span>
          </div>
        </Link>
      </Button>
    </div>
  );
}
