import { useTranslation } from 'react-i18next';

import { useStationInsights } from '@/api/insights';
import { CardContent } from '@/components/ui/card';

import { NAMESPACE } from './StationDetail.i18n';

type StationHistoricalInsightsProps = {
  stationId: string;
};

export function StationHistoricalInsights({ stationId }: StationHistoricalInsightsProps) {
  const { t } = useTranslation(NAMESPACE);
  const { data: insights } = useStationInsights(stationId);

  return (
    <CardContent className="min-h-5">
      {insights && (
        <div className="text-muted-foreground flex items-baseline justify-between gap-3 text-sm">
          <p>
            {t('stationRank', {
              position: insights.ranking.position,
              population: insights.ranking.population,
            })}
          </p>
          <p>{t('stationReportsLast30Days', { count: insights.reportCount.value })}</p>
        </div>
      )}
    </CardContent>
  );
}
