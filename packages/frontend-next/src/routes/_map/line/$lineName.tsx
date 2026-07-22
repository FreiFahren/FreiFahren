import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { type Line, linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { LineDetail, type LineDetailLine } from '@/components/map/LineDetail';
import type { LineDetailSource } from '@/lib/analytics';

const lineDetailSources = new Set<LineDetailSource>([
  'direct',
  'map',
  'report',
  'reports_list',
  'search',
  'station',
]);

type LineDetailSearch = { source: LineDetailSource };

function mergeStationOrder(variants: Line[]): string[] {
  const orderedVariants = [...variants].sort((a, b) => b.stations.length - a.stations.length);
  const stations = [...orderedVariants[0]!.stations];
  const seen = new Set(stations);

  for (const variant of orderedVariants.slice(1)) {
    for (const [index, stationId] of variant.stations.entries()) {
      if (seen.has(stationId)) continue;

      const nextKnownStation = variant.stations.slice(index + 1).find((id) => seen.has(id));
      if (nextKnownStation) stations.splice(stations.indexOf(nextKnownStation), 0, stationId);
      else stations.push(stationId);
      seen.add(stationId);
    }
  }

  return stations;
}

function mergeLineVariants(variants: Line[]): LineDetailLine {
  const representative = variants.reduce((longest, line) =>
    line.stations.length > longest.stations.length ? line : longest,
  );
  return {
    name: representative.name,
    type: representative.type,
    color: representative.color,
    isCircular: variants.some((line) => line.isCircular),
    stations: mergeStationOrder(variants),
    variantIds: variants.map((line) => line.id),
  };
}

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
  return <LineDetail line={line} source={source} onClose={() => navigate({ to: '/' })} />;
}
