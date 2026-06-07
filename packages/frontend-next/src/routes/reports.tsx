import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { queryClient } from '@/api/queryClient';
import { DAY_MS, HOUR_MS, reportsSliceQueryOptions, useReports } from '@/api/reports';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { ReportsTabBar } from '@/components/reports/ReportsTabBar';
import { NAMESPACE } from '@/components/reports/Reports.i18n';
import { PageHeader } from '@/components/templates/PageHeader';

export const Route = createFileRoute('/reports')({
  staticData: { legalDisclaimer: false },
  // Prefetch what this section renders (the day window + stations + lines). Runs for any reports
  // tab on preload (it's the shared layout). Fire-and-forget so it never blocks the transition;
  // already-cached queries are no-ops. Covers all tabs, so they need no loader of their own.
  loader: () => {
    void queryClient.prefetchQuery(reportsSliceQueryOptions(HOUR_MS, 0));
    void queryClient.prefetchQuery(reportsSliceQueryOptions(DAY_MS, HOUR_MS));
    void queryClient.prefetchQuery(stationsQueryOptions());
    void queryClient.prefetchQuery(linesQueryOptions());
  },
  component: ReportsOverviewLayout,
});

function ReportsOverviewLayout() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const { data: reports } = useReports(DAY_MS);

  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <PageHeader title={t('title')} onBack={() => navigate({ to: '/' })} />
        <div className="flex items-baseline gap-2 px-4 pt-2 pb-4">
          <span className="font-heading text-3xl font-semibold">{reports?.length ?? 0}</span>
          <span className="text-muted-foreground text-sm">{t('summaryCount')}</span>
        </div>
        <ReportsTabBar />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
