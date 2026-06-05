import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { HOUR_MS, reportsSliceQueryOptions } from '@/api/reports';
import { fetchStations } from '@/api/transit';
import { queryClient } from '@/api/queryClient';
import { StationDetail } from '@/components/map/StationDetail';
import { Route as ReportDetailRoute } from '@/routes/_map/reports/$stationId';

export const Route = createFileRoute('/_map/station/$stationId')({
  staticData: { legalDisclaimer: true },
  loader: async ({ params }) => {
    const stations = await queryClient.ensureQueryData({
      queryKey: ['transit', 'stations'],
      queryFn: fetchStations,
    });
    const station = stations[params.stationId];
    if (!station) throw redirect({ to: '/', replace: true });

    // A station deep link (e.g. from the Telegram bot) should land on the live report view when
    // there's a sighting from the last hour, matching the recent/older split in the reports list.
    // Reuses the map's cached last-hour slice, so this rarely costs an extra request.
    const recentReports = await queryClient.ensureQueryData(reportsSliceQueryOptions(HOUR_MS, 0));
    if (recentReports.some((report) => report.stationId === params.stationId)) {
      throw redirect({ to: ReportDetailRoute.to, params, replace: true });
    }

    return { station };
  },
  component: StationRoute,
});

function StationRoute() {
  const { station } = Route.useLoaderData();
  const navigate = useNavigate();
  return <StationDetail station={station} onClose={() => navigate({ to: '/' })} />;
}
