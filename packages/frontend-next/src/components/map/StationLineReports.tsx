import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import type { Ref } from 'react';
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

type LineReportRowProps = {
  line: StationLineReports;
  onSelect?: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  reportsLoaded?: boolean;
};

export function LineReportRow({
  line,
  onSelect,
  buttonRef,
  reportsLoaded = true,
}: LineReportRowProps) {
  const { t } = useTranslation(NAMESPACE);
  const hasRecentReports = reportsLoaded && line.reportsInLastHour > 0;
  const content = (
    <>
      <LineBadge name={line.name} />
      <div className="text-muted-foreground flex-1 text-sm">
        <p>
          {reportsLoaded
            ? t('lineReportsLast24Hours', { count: line.reportsInLast24Hours })
            : t('lineReportsLoading')}
        </p>
        {hasRecentReports && (
          <p className="text-muted-foreground text-xs">
            {t('inLastHour', { count: line.reportsInLastHour })}
          </p>
        )}
      </div>
      <ChevronRight className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </>
  );
  const className =
    'hover:bg-muted/70 focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2';

  if (onSelect) {
    return (
      <button type="button" ref={buttonRef} onClick={onSelect} className={className}>
        {content}
      </button>
    );
  }

  return (
    <Link
      to={LineDetailRoute.to}
      params={{ lineName: line.name }}
      search={{ source: 'station' }}
      onClick={() => track('station_line_selected', { line_id: line.name })}
      className={className}
    >
      {content}
    </Link>
  );
}

export function StationLineReports({ lineReports }: StationLineReportsProps) {
  const { t } = useTranslation(NAMESPACE);
  const rankedLines = sortStationLineReports(lineReports);

  return (
    <CardContent className="space-y-2">
      <p className="text-muted-foreground text-xs">{t('lineReportsDescription')}</p>
      <div className="divide-border max-h-[30dvh] overflow-y-auto overscroll-contain rounded-md border">
        {rankedLines.map((line) => (
          <LineReportRow key={line.name} line={line} />
        ))}
      </div>
    </CardContent>
  );
}
