import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { type CSSProperties, type Ref } from 'react';
import { useTranslation } from 'react-i18next';

import { formatElapsed, type Report } from '@/api/reports';
import { useLines, useStations } from '@/api/transit';
import { track } from '@/lib/analytics';
import { selectionTap } from '@/lib/haptics';
import { LineBadge } from '@/components/transit/LineBadge';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';
import { Route as StationRoute } from '@/routes/_map/station/$stationId';

import { NAMESPACE } from './Reports.i18n';

export function ReportRow({
  report,
  recent,
  ref,
  style,
  dataIndex,
}: {
  report: Report;
  recent: boolean;
  // Optional hooks so the row can be positioned by a virtualizer (absolute style + measure ref).
  ref?: Ref<HTMLLIElement>;
  style?: CSSProperties;
  dataIndex?: number;
}) {
  const { t } = useTranslation(NAMESPACE);
  const { data: lines } = useLines();
  const { data: stations } = useStations();

  const lineName = report.lineId
    ? lines?.find((line) => line.id === report.lineId)?.name
    : undefined;
  const stationName = stations?.[report.stationId]?.name;
  const directionName = report.directionId ? stations?.[report.directionId]?.name : undefined;

  const content = (
    <>
      <div className="flex items-center gap-3">
        {lineName && <LineBadge name={lineName} />}
        <span className="flex-1 truncate text-base">{stationName}</span>
        <span className="text-muted-foreground shrink-0 text-sm">
          {formatElapsed(report.timestamp, t)}
        </span>
        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
      </div>
      {directionName && (
        <p className="text-muted-foreground text-sm">{t('direction', { name: directionName })}</p>
      )}
    </>
  );

  const trackSelection = (opensStationDetail: boolean) => {
    selectionTap();
    track('report_row_selected', {
      report_age_minutes: Math.round((Date.now() - new Date(report.timestamp).getTime()) / 60000),
      has_line: report.lineId !== null,
      has_direction: report.directionId !== null,
    });
    if (opensStationDetail) track('station_selected', { source: 'reports_list' });
  };

  // A report from the last hour opens the live report view; older ones fall back to the station.
  return (
    <li ref={ref} data-index={dataIndex} style={style} className="border-border/60 border-b">
      {recent ? (
        <Link
          to={ReportDetailRoute.to}
          params={{ stationId: report.stationId }}
          className="flex flex-col gap-1 px-4 py-3"
          onClick={() => trackSelection(false)}
        >
          {content}
        </Link>
      ) : (
        <Link
          to={StationRoute.to}
          params={{ stationId: report.stationId }}
          className="flex flex-col gap-1 px-4 py-3"
          onClick={() => trackSelection(true)}
        >
          {content}
        </Link>
      )}
    </li>
  );
}
