import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { fetchStations } from '@/api/transit';
import { ReportDetail } from '@/components/map/ReportDetail';

export const Route = createFileRoute('/_map/reports/$stationId')({
  loader: async ({ params }) => {
    const stations = await queryClient.ensureQueryData({
      queryKey: ['transit', 'stations'],
      queryFn: fetchStations,
    });
    const station = stations[params.stationId];
    if (!station) throw redirect({ to: '/', replace: true });
    return { station };
  },
  component: ReportRoute,
});

function ReportRoute() {
  const { station } = Route.useLoaderData();
  const navigate = useNavigate();
  return <ReportDetail station={station} onClose={() => navigate({ to: '/' })} />;
}
