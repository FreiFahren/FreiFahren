import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { stationsQueryOptions } from '@/api/transit';
import { queryClient } from '@/api/queryClient';
import { StationDetail } from '@/components/map/StationDetail';

export const Route = createFileRoute('/_map/station/$stationId')({
  staticData: { legalDisclaimer: true },
  loader: async ({ params }) => {
    const stations = await queryClient.ensureQueryData(stationsQueryOptions());
    const station = stations[params.stationId];
    if (!station) throw redirect({ to: '/', replace: true });

    return { station };
  },
  component: StationRoute,
});

function StationRoute() {
  const { station } = Route.useLoaderData();
  const navigate = useNavigate();
  return <StationDetail station={station} onClose={() => navigate({ to: '/' })} />;
}
