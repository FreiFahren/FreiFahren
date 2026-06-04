import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { fetchStations } from '@/api/transit';
import { queryClient } from '@/api/queryClient';
import { StationDetail } from '@/components/map/StationDetail';

export const Route = createFileRoute('/_map/stations/$stationId')({
  staticData: { legalDisclaimer: true },
  loader: async ({ params }) => {
    const stations = await queryClient.ensureQueryData({
      queryKey: ['transit', 'stations'],
      queryFn: fetchStations,
    });
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
