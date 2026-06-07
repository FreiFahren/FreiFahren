import { createFileRoute } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { ReportForm } from '@/components/report/ReportForm';

type ReportSearch = { stationId?: string };

export const Route = createFileRoute('/report')({
  staticData: { legalDisclaimer: false },
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    stationId: typeof search.stationId === 'string' ? search.stationId : undefined,
  }),
  // Prefetch what the form renders (stations + lines). Fire-and-forget; no-op if already cached.
  loader: () => {
    void queryClient.prefetchQuery(stationsQueryOptions());
    void queryClient.prefetchQuery(linesQueryOptions());
  },
  component: ReportForm,
});
