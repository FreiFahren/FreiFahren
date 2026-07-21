import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useLineInsights } from '@/api/insights';
import { DAY_MS, HOUR_MS, useReports } from '@/api/reports';
import { useStations } from '@/api/transit';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { useModalViewDuration } from '@/hooks/useModalViewDuration';
import { track } from '@/lib/analytics';
import { currentCity } from '@/lib/city';
import { cn } from '@/lib/utils';
import { Route as ReportRoute } from '@/routes/report';

import { DetailCard } from './DetailCard';
import { HotspotList } from './HotspotList';
import { LineCurrentActivity } from './LineCurrentActivity';
import { NAMESPACE } from './LineDetail.i18n';
import { RhythmChart } from './RhythmChart';

export type LineDetailLine = {
  name: string;
  type: 'subway' | 'light_rail' | 'tram';
  isCircular: boolean;
  color: string;
  stations: string[];
  variantIds: string[];
};

type LineDetailProps = { line: LineDetailLine; onClose: () => void };

const cityHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: currentCity.timezone,
  hour: '2-digit',
  hourCycle: 'h23',
});

const hourInCityTime = (timestamp: string) => Number(cityHourFormatter.format(new Date(timestamp)));
const currentCityHour = () => hourInCityTime(new Date().toISOString());

function countReportsOnLine(
  reports: ReturnType<typeof useReports>['data'],
  variantIds: Set<string>,
) {
  let count = 0;
  for (const report of reports ?? []) {
    if (report.isPredicted || !report.lineId || !variantIds.has(report.lineId)) continue;
    count += 1;
  }
  return count;
}

export function LineDetail({ line, onClose }: LineDetailProps) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const { data: insights } = useLineInsights(line.name);
  const { data: reports, isSuccess: hasLiveReports } = useReports(DAY_MS);
  const { data: lastHourReports } = useReports(HOUR_MS);
  const { data: stations } = useStations();
  useModalViewDuration('line');

  useEffect(() => {
    track('line_detail_opened', { line_id: line.name, source: 'station' });
  }, [line.name]);

  const variantIds = new Set(line.variantIds);
  const recentReportCount = countReportsOnLine(reports, variantIds);
  const lastHourReportCount = countReportsOnLine(lastHourReports, variantIds);

  const weekday = insights
    ? new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }).format(
        new Date(2024, 0, insights.profile.weekday, 12),
      )
    : '';
  const peak = insights?.profile.hours.reduce((best, hour) =>
    hour.value > best.value ? hour : best,
  );
  let quietAfter: number | null = null;
  for (const hour of insights?.profile.hours ?? []) {
    if (hour.value > 0) quietAfter = hour.hour + 1;
  }
  const start = line.stations[0] ? stations?.[line.stations[0]]?.name : undefined;
  const end = line.stations.at(-1) ? stations?.[line.stations.at(-1)!]?.name : undefined;

  return (
    <DetailCard
      title={
        <div className="flex items-center gap-3 pr-2">
          <span
            className="rounded-sm px-3 py-1 text-sm font-semibold text-white"
            style={{ backgroundColor: line.color }}
          >
            {line.name}
          </span>
          {!line.isCircular && <span>{start && end ? `${start} ↔ ${end}` : line.name}</span>}
        </div>
      }
      closeLabel={t('close')}
      onClose={onClose}
      cardClassName="h-[min(38rem,calc(100dvh-3rem))] overflow-hidden"
    >
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden',
          !insights && 'min-h-[23.5rem]',
        )}
        aria-busy={!insights}
      >
        {insights && (
          <>
            {hasLiveReports && (
              <LineCurrentActivity
                reportsInLast24Hours={recentReportCount}
                reportsInLastHour={lastHourReportCount}
              />
            )}
            <section aria-labelledby="line-typical-activity-heading" className="shrink-0">
              <CardContent className="shrink-0 space-y-3 pt-1">
                <h3
                  id="line-typical-activity-heading"
                  className="text-text-3 text-[11px] font-semibold tracking-widest uppercase"
                >
                  {insights.profile.source === 'city_reports'
                    ? t('typicalCity', { weekday, city: currentCity.displayName })
                    : t('typical', { weekday })}
                </h3>
                <RhythmChart
                  hours={insights.profile.hours}
                  currentHour={currentCityHour()}
                  label={t('chartLabel', { weekday })}
                />
                <div className="text-text-3 flex justify-between text-xs">
                  <span>{peak ? t('peak', { hour: peak.hour }) : null}</span>
                  <span>{quietAfter ? t('quietAfter', { hour: quietAfter }) : null}</span>
                </div>
              </CardContent>
            </section>
            <section
              aria-labelledby="line-hotspots-heading"
              className="flex min-h-0 flex-1 flex-col"
            >
              <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 pt-1">
                <h3
                  id="line-hotspots-heading"
                  className="text-text-3 text-[11px] font-semibold tracking-widest uppercase"
                >
                  {t('usualHotspots')}
                </h3>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <HotspotList
                    lineName={line.name}
                    color={line.color}
                    hotspots={insights.hotspots.stations}
                    stationOrder={line.stations}
                    stationData={stations}
                    emptyLabel={t('noHotspots')}
                  />
                </div>
              </CardContent>
            </section>
          </>
        )}
      </div>
      <CardContent className="mt-1 shrink-0 pb-1">
        <Button
          asChild
          variant="default"
          className="bg-destructive hover:bg-destructive/90 h-12 w-full font-semibold text-white"
        >
          <Link
            to={ReportRoute.to}
            search={{ lineName: line.name }}
            onClick={() => track('line_detail_cta_clicked', { line_id: line.name })}
          >
            {t('reportSighting', { line: line.name })}
          </Link>
        </Button>
      </CardContent>
    </DetailCard>
  );
}
