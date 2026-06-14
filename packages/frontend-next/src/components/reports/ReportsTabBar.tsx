import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { track } from '@/lib/analytics';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Route as LinesRoute } from '@/routes/reports/lines';
import { Route as StationsRoute } from '@/routes/reports/stations';
import { Route as SummaryRoute } from '@/routes/reports/index';

import { NAMESPACE } from './Reports.i18n';

const TABS = [
  { route: SummaryRoute, labelKey: 'tabSummary', tab: 'summary' },
  { route: LinesRoute, labelKey: 'tabLines', tab: 'lines' },
  { route: StationsRoute, labelKey: 'tabReports', tab: 'reports' },
] as const;

export function ReportsTabBar() {
  const { t } = useTranslation(NAMESPACE);
  // The active tab is whichever tab route is the current leaf match — derived from the route
  // objects' ids rather than hard-coded paths, so it stays correct if the routes move.
  const activeRouteId = useRouterState({
    select: (state): string | undefined => state.matches[state.matches.length - 1]?.routeId,
  });

  return (
    <Tabs value={activeRouteId ?? SummaryRoute.id} className="px-4">
      <TabsList className="border-border grid w-full grid-cols-3 border-b">
        {TABS.map((tab) => (
          <TabsTrigger
            key={tab.route.id}
            value={tab.route.id}
            asChild
            className="text-muted-foreground data-[state=active]:text-foreground data-[state=active]:border-foreground -mb-px rounded-none border-b-2 border-transparent py-3 text-xs font-semibold tracking-wide uppercase"
          >
            <Link
              to={tab.route.to}
              onClick={() => track('reports_tab_selected', { tab: tab.tab })}
            >
              {t(tab.labelKey)}
            </Link>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
