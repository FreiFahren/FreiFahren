import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { LinePicker } from '@/components/map/line-picker';
import { Route as MapIndexRoute } from '@/routes/_map/index';
import { Route as LineDetailRoute } from '@/routes/_map/line/$lineName';

type LinePickerSearch = { names: string[] };

// Opened by a map tap that several lines run under; lists them so the user can pick one.
export const Route = createFileRoute('/_map/line/')({
  staticData: { legalDisclaimer: true },
  validateSearch: (search: Record<string, unknown>): LinePickerSearch => ({
    names: Array.isArray(search.names)
      ? search.names.filter((name): name is string => typeof name === 'string')
      : [],
  }),
  loaderDeps: ({ search }) => ({ names: search.names }),
  loader: async ({ deps }) => {
    const [lines] = await Promise.all([
      queryClient.ensureQueryData(linesQueryOptions()),
      queryClient.ensureQueryData(stationsQueryOptions()),
    ]);
    const known = new Set(lines.map((line) => line.name));
    const names = [...new Set(deps.names)].filter((name) => known.has(name));

    const [only] = names;
    if (!only) throw redirect({ to: MapIndexRoute.to, replace: true });
    if (names.length === 1) {
      throw redirect({
        to: LineDetailRoute.to,
        params: { lineName: only },
        search: { source: 'map' },
        replace: true,
      });
    }
    return { names };
  },
  component: LinePickerRoute,
});

function LinePickerRoute() {
  const { names } = Route.useLoaderData();
  const navigate = useNavigate();
  return <LinePicker lineNames={names} onClose={() => navigate({ to: MapIndexRoute.to })} />;
}
