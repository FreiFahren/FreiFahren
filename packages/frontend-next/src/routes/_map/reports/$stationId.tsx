import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { stationReportCountQueryOptions } from '@/api/reports';
import { stationsQueryOptions } from '@/api/transit';
import { ReportDetail } from '@/components/map/ReportDetail';

export const Route = createFileRoute('/_map/reports/$stationId')({
  staticData: { legalDisclaimer: true },
  loader: async ({ params }) => {
    const stations = await queryClient.ensureQueryData(stationsQueryOptions());
    const station = stations[params.stationId];
    if (!station) throw redirect({ to: '/', replace: true });
    // Fire-and-forget warm of the "X times this week" count ReportDetail shows, so a preload
    // (idle, or from a hovered/visible marker) makes it instant on open. (Distance can't be
    // warmed here — it needs the live user position, which lives in React state, not the loader.)
    void queryClient.prefetchQuery(stationReportCountQueryOptions(params.stationId));
    return { station };
  },
  component: ReportRoute,
});

function ReportRoute() {
  const { station } = Route.useLoaderData();
  const navigate = useNavigate();
  return <ReportDetail station={station} onClose={() => navigate({ to: '/' })} />;
}
