import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { DAY_MS, useReports } from '@/api/reports';
import { type Station, useLines } from '@/api/transit';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useModalViewDuration } from '@/hooks/useModalViewDuration';
import { Route as ReportRoute } from '@/routes/report';

import { DetailCard } from './DetailCard';
import { NAMESPACE } from './StationDetail.i18n';
import { StationLineReports } from './StationLineReports';
import { StationHistoricalInsights } from './StationHistoricalInsights';
import { stationLiveData } from './station-detail-data';

type StationDetailProps = {
  station: Station;
  onClose: () => void;
};

export function StationDetail({ station, onClose }: StationDetailProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: lines } = useLines();
  const { data: reports, isSuccess: hasLiveReports } = useReports(DAY_MS);
  const { stationReportCount, lineReports } = stationLiveData(station, lines, reports);
  useModalViewDuration('station');

  return (
    <DetailCard
      title={station.name}
      closeLabel={t('close')}
      onClose={onClose}
      cardClassName="max-h-[calc(100dvh-6rem)]"
    >
      <StationHistoricalInsights stationId={station.id} />
      {hasLiveReports && lineReports.length > 0 && (
        <StationLineReports stationReportCount={stationReportCount} lineReports={lineReports} />
      )}
      <CardContent className="mt-2">
        <Button
          asChild
          variant="default"
          className="bg-destructive hover:bg-destructive/90 h-11 w-full text-sm font-semibold text-white"
        >
          <Link to={ReportRoute.to} search={{ stationId: station.id }}>
            {t('reportSighting')}
          </Link>
        </Button>
      </CardContent>
    </DetailCard>
  );
}
