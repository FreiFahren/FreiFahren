import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { queryClient } from '@/api/queryClient';
import { DAY_MS, HOUR_MS, reportsSliceQueryOptions } from '@/api/reports';
import { reportStatisticsQueryOptions, useReportStatistics } from '@/api/statistics';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';
import { ReportsTabBar } from '@/components/reports/ReportsTabBar';
import { NAMESPACE } from '@/components/reports/Reports.i18n';
import {
  StatisticsPeriodPicker,
  StatisticsPeriodProvider,
} from '@/components/reports/statistics-period';
import { useStatisticsPeriod } from '@/components/reports/use-statistics-period';
import { FullScreenPage } from '@/components/templates/full-screen-page';
import { PageHeader } from '@/components/templates/PageHeader';
import { track } from '@/lib/analytics';

export const Route = createFileRoute('/reports')({
  staticData: { legalDisclaimer: false },
  // Prefetch what this section renders (the default statistics period, the day window for the
  // reports list, stations + lines). Runs for any reports tab on preload (it's the shared layout).
  // Fire-and-forget so it never blocks the transition; already-cached queries are no-ops. Covers
  // all tabs, so they need no loader of their own.
  loader: () => {
    void queryClient.prefetchQuery(reportStatisticsQueryOptions('24h'));
    void queryClient.prefetchQuery(reportsSliceQueryOptions(HOUR_MS, 0));
    void queryClient.prefetchQuery(reportsSliceQueryOptions(DAY_MS, HOUR_MS));
    void queryClient.prefetchQuery(stationsQueryOptions());
    void queryClient.prefetchQuery(linesQueryOptions());
  },
  component: ReportsOverviewLayout,
});

function ReportsOverviewLayout() {
  return (
    <StatisticsPeriodProvider>
      <ReportsOverview />
    </StatisticsPeriodProvider>
  );
}

function ReportsOverview() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const [period] = useStatisticsPeriod();
  const { data: statistics } = useReportStatistics(period);

  // One open event per visit, fired once the count is known (so report_count is the real figure
  // shown, not 0 before the prefetch resolves). The ref guards against re-firing on data refetch
  // and period changes, so the count is always the default 24 h one.
  const openTracked = useRef(false);
  useEffect(() => {
    if (openTracked.current || statistics === undefined) return;
    openTracked.current = true;
    track('reports_overview_opened', { report_count: statistics.reportCount });
  }, [statistics]);

  return (
    <FullScreenPage>
      <PageHeader
        title={t('title')}
        onBack={() => navigate({ to: '/' })}
        action={
          <FeedbackButton
            source="reports_overview"
            size="xs"
            className="text-muted-foreground hover:text-foreground"
          />
        }
      />
      <div className="flex items-center justify-between gap-3 px-4 pt-2 pb-4">
        {/* The label sits under the count so the picker fits beside it even on narrow phones. */}
        <div className="flex min-w-0 flex-col">
          <span className="font-heading text-3xl leading-none font-semibold">
            {statistics?.reportCount ?? 0}
          </span>
          <span className="text-muted-foreground mt-1 truncate text-xs">
            {t('summaryCount', { period: t(`periodLong.${period}`) })}
          </span>
        </div>
        <StatisticsPeriodPicker className="shrink-0" />
      </div>
      <ReportsTabBar />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </FullScreenPage>
  );
}
