import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { stationsQueryOptions } from '@/api/transit';
import { RouteLayer } from '@/components/route/route-layer';
import { RouteResult } from '@/components/route/route-result';

export const Route = createFileRoute('/_map/route/$fromId/$toId')({
  staticData: { legalDisclaimer: true },
  loader: async ({ params }) => {
    const stations = await queryClient.ensureQueryData(stationsQueryOptions());
    // Both ends have to exist before the endpoint is asked; an unknown id would only
    // come back as a 404 the user cannot act on.
    if (!stations[params.fromId] || !stations[params.toId])
      throw redirect({ to: '/', replace: true });
    if (params.fromId === params.toId) throw redirect({ to: '/', replace: true });

    return { stations };
  },
  component: JourneyRoute,
});

function JourneyRoute() {
  const { stations } = Route.useLoaderData();
  const { fromId, toId } = Route.useParams();
  const navigate = useNavigate();

  return (
    <>
      <RouteLayer fromId={fromId} toId={toId} />
      <RouteResult
        fromId={fromId}
        toId={toId}
        stations={stations}
        onClose={() => navigate({ to: '/' })}
      />
    </>
  );
}
