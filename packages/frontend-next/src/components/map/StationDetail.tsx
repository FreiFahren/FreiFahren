import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { resolveStationLineNames, type Station, useLines } from '@/api/transit';
import { LineBadge } from '@/components/transit/LineBadge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Route as ReportRoute } from '@/routes/report';

import { DetailCard } from './DetailCard';
import { NAMESPACE } from './StationDetail.i18n';

type StationDetailProps = {
  station: Station;
  onClose: () => void;
};

export function StationDetail({ station, onClose }: StationDetailProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: lines } = useLines();
  const lineNames = resolveStationLineNames(station.lines, lines);

  return (
    <DetailCard title={station.name} closeLabel={t('close')} onClose={onClose}>
      <CardContent className="flex flex-wrap gap-1.5">
        {lineNames.map((name) => (
          <LineBadge key={name} name={name} />
        ))}
      </CardContent>
      <CardContent className="mt-2">
        <Button
          asChild
          variant="default"
          className="bg-destructive hover:bg-destructive/90 h-9 w-full text-sm font-medium text-white"
        >
          <Link to={ReportRoute.to}>{t('reportSighting')}</Link>
        </Button>
      </CardContent>
    </DetailCard>
  );
}
