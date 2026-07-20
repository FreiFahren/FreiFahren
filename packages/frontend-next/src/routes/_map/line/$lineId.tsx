import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { LineDetail } from '@/components/map/LineDetail';

export const Route = createFileRoute('/_map/line/$lineId')({
  staticData: { legalDisclaimer: true },
  loader: async ({ params }) => {
    const [lines] = await Promise.all([
      queryClient.ensureQueryData(linesQueryOptions()),
      queryClient.ensureQueryData(stationsQueryOptions()),
    ]);
    const line = lines.find((candidate) => candidate.id === params.lineId);
    if (!line) throw redirect({ to: '/', replace: true });
    return { line };
  },
  component: LineRoute,
});

function LineRoute() {
  const { line } = Route.useLoaderData();
  const navigate = useNavigate();
  return <LineDetail line={line} onClose={() => navigate({ to: '/' })} />;
}
