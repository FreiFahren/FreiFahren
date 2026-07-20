import { Link } from '@tanstack/react-router';
import { ChevronRight, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatElapsed, HOUR_MS, useReports, useStationReportCount } from '@/api/reports';
import { type Station, useLines, useStations, useStationDistance } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { CardContent } from '@/components/ui/card';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { useModalViewDuration } from '@/hooks/useModalViewDuration';
import { track } from '@/lib/analytics';
import { currentCity } from '@/lib/city';
import { Route as LineDetailRoute } from '@/routes/_map/line/$lineName';
import { Route as StationRoute } from '@/routes/_map/station/$stationId';

import { DetailCard } from './DetailCard';
import { NAMESPACE } from './ReportDetail.i18n';
import { SocialLinks } from './SocialLinks';

type ReportDetailProps = {
  station: Station;
  onClose: () => void;
};

// Telegram group the reports are synced with.
const REPORTS_GROUP_HANDLE = currentCity.community.telegramHandle;

export function ReportDetail({ station, onClose }: ReportDetailProps) {
  const { t } = useTranslation(NAMESPACE);
  useModalViewDuration('report');
  const { data: reports } = useReports(HOUR_MS);
  const { data: lines } = useLines();
  const { data: stations } = useStations();
  const { data: numberOfReports } = useStationReportCount(station.id);
  const { position } = useGeolocation();
  // Stations between the user's nearest station and this report; absent until location is shared
  // and the lookup resolves (and stays absent if the backend can't route between them).
  const { data: stationDistance } = useStationDistance(station.id, position);

  const report = (reports ?? [])
    .filter((r) => r.stationId === station.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  const lineName = report?.lineId
    ? lines?.find((line) => line.id === report.lineId)?.name
    : undefined;
  const directionName = report?.directionId ? stations?.[report.directionId]?.name : undefined;

  return (
    <DetailCard
      title={
        <Link
          to={StationRoute.to}
          params={{ stationId: station.id }}
          className="inline-flex items-center gap-0.5 rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={t('openStationDetails', { station: station.name })}
          onClick={() => track('station_selected', { source: 'report' })}
        >
          {station.name}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      }
      closeLabel={t('close')}
      onClose={onClose}
    >
      {lineName ? (
        <CardContent className="px-0">
          <Link
            to={LineDetailRoute.to}
            params={{ lineName }}
            className="hover:bg-muted/70 focus-visible:ring-ring flex items-center gap-2 px-4 py-2 outline-none focus-visible:ring-2"
          >
            <LineBadge name={lineName} className="underline underline-offset-2" />
            {directionName && <span className="text-sm font-semibold">{directionName}</span>}
            <ChevronRight className="text-muted-foreground ml-auto size-4 shrink-0" aria-hidden />
          </Link>
        </CardContent>
      ) : (
        directionName && (
          <CardContent className="flex items-center gap-2">
            <span className="text-sm font-semibold">{directionName}</span>
          </CardContent>
        )
      )}
      <CardContent className="space-y-1">
        {report && (
          <p className="text-muted-foreground text-sm">{formatElapsed(report.timestamp, t)}</p>
        )}
        {/* Reserve the line height so the distance resolving in does not shift layout. */}
        <p className="text-muted-foreground flex min-h-5 items-center gap-1 text-sm">
          {stationDistance !== undefined && (
            <>
              <MapPin className="size-3.5 shrink-0" />
              {stationDistance <= 1
                ? t('oneStationAway')
                : t('stationsAway', { count: stationDistance })}
            </>
          )}
        </p>
        {/* Reserve the line height so the count loading in does not shift layout. */}
        <p className="min-h-5 text-sm">
          {numberOfReports !== undefined && numberOfReports > 0 && (
            <>
              <span className="font-semibold">
                {numberOfReports} {t('times')}
              </span>{' '}
              {t('thisWeek')}
            </>
          )}
        </p>
      </CardContent>
      <CardContent className="text-muted-foreground flex items-end justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <p>{t('inviteText')}</p>
          <p>{t('syncText', { group: REPORTS_GROUP_HANDLE })}</p>
        </div>
        <SocialLinks appearance="inline" className="-mr-2 shrink-0" />
      </CardContent>
    </DetailCard>
  );
}
