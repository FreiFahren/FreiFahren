import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { LineDetail } from '@/components/map/LineDetail';
import type { LineDetailSource } from '@/lib/analytics';
import { mergeLineVariants } from '@/lib/line-variants';
import { Route as ReportsStationsRoute } from '@/routes/reports/stations';

const lineDetailSources = new Set<LineDetailSource>([
  'direct',
  'map',
  'report',
  'reports_list',
  'search',
  'station',
]);

type LineDetailSearch = { source: LineDetailSource };

export const Route = createFileRoute('/_map/line/$lineName')({
  staticData: { legalDisclaimer: true },
  validateSearch: (search: Record<string, unknown>): LineDetailSearch => ({
    source:
      typeof search.source === 'string' && lineDetailSources.has(search.source as LineDetailSource)
        ? (search.source as LineDetailSource)
        : 'direct',
  }),
  loader: async ({ params }) => {
    const [lines] = await Promise.all([
      queryClient.ensureQueryData(linesQueryOptions()),
      queryClient.ensureQueryData(stationsQueryOptions()),
    ]);
    const variants = lines.filter((candidate) => candidate.name === params.lineName);
    if (variants.length === 0) throw redirect({ to: '/', replace: true });
    return { line: mergeLineVariants(variants) };
  },
  component: LineRoute,
});

function LineRoute() {
  const { line } = Route.useLoaderData();
  const { source } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <LineDetail
      line={line}
      source={source}
      onClose={() =>
        source === 'reports_list'
          ? navigate({ to: ReportsStationsRoute.to, search: { lineName: line.name } })
          : navigate({ to: '/' })
      }
    />
  );
}
