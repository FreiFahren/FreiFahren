import { createFileRoute } from '@tanstack/react-router';

import { queryClient } from '@/api/queryClient';
import { reportingStatusQueryOptions } from '@/api/reports';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { ReportForm } from '@/components/report/ReportForm';

type ReportSearch = { stationId?: string; lineName?: string };

export const Route = createFileRoute('/report')({
  staticData: { legalDisclaimer: false },
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    stationId: typeof search.stationId === 'string' ? search.stationId : undefined,
    lineName: typeof search.lineName === 'string' ? search.lineName : undefined,
  }),
  // Prefetch what the form renders (stations + lines) and the killswitch check. Fire-and-forget;
  // no-op if already cached.
  loader: () => {
    void queryClient.prefetchQuery(stationsQueryOptions());
    void queryClient.prefetchQuery(linesQueryOptions());
    void queryClient.prefetchQuery(reportingStatusQueryOptions);
  },
  component: ReportForm,
});
