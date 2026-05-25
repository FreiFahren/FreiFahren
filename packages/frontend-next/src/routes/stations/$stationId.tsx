import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { fetchStations } from '@/api/transit';
import { queryClient } from '@/api/queryClient';
import { StationDetail } from '@/components/map/StationDetail';
import { Route as IndexRoute } from '@/routes/index';

export const Route = createFileRoute('/stations/$stationId')({
  loader: async ({ params }) => {
    const stations = await queryClient.ensureQueryData({
      queryKey: ['transit', 'stations'],
      queryFn: fetchStations,
    });
    const station = stations[params.stationId];
    if (!station) throw redirect({ to: IndexRoute.to, replace: true });
    return { station };
  },
  component: StationRoute,
});

function StationRoute() {
  const { station } = Route.useLoaderData();
  const navigate = useNavigate();
  return <StationDetail station={station} onClose={() => navigate({ to: IndexRoute.to })} />;
}
