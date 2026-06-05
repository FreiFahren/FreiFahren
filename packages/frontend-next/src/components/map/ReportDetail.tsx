import { MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { formatElapsed, HOUR_MS, useReports, useStationReportCount } from '@/api/reports';
import { type Station, useLines, useStations, useStationDistance } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { CardContent } from '@/components/ui/card';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { optionalEnv } from '@/lib/utils';

import { DetailCard } from './DetailCard';
import { NAMESPACE } from './ReportDetail.i18n';

type ReportDetailProps = {
  station: Station;
  onClose: () => void;
};

// Telegram group the reports are synced with.
const REPORTS_GROUP_HANDLE = optionalEnv('VITE_REPORTS_GROUP_HANDLE') ?? '@FreiFahren_BE';

export function ReportDetail({ station, onClose }: ReportDetailProps) {
  const { t } = useTranslation(NAMESPACE);
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
    <DetailCard title={station.name} closeLabel={t('close')} onClose={onClose}>
      {(lineName || directionName) && (
        <CardContent className="flex items-center gap-2">
          {lineName && <LineBadge name={lineName} />}
          {directionName && <span className="text-sm font-medium">{directionName}</span>}
        </CardContent>
      )}
      <CardContent className="space-y-1">
        {report && (
          <p className="text-muted-foreground text-sm">{formatElapsed(report.timestamp, t)}</p>
        )}
        {stationDistance !== undefined && (
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <MapPin className="size-3.5 shrink-0" />
            {stationDistance <= 1
              ? t('oneStationAway')
              : t('stationsAway', { count: stationDistance })}
          </p>
        )}
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
      <CardContent className="text-muted-foreground space-y-0.5 text-xs">
        <p>{t('inviteText')}</p>
        <p>{t('syncText', { group: REPORTS_GROUP_HANDLE })}</p>
      </CardContent>
    </DetailCard>
  );
}
