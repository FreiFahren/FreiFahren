import { createFileRoute } from '@tanstack/react-router';

import { configQueryOptions } from '@/api/config';
import { queryClient } from '@/api/queryClient';
import { linesQueryOptions, stationsQueryOptions } from '@/api/transit';
import { ReportForm } from '@/components/report/ReportForm';

type ReportSearch = { stationId?: string; lineName?: string };

export const Route = createFileRoute('/report')({
  staticData: { legalDisclaimer: false },
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    stationId: typeof search.stationId === 'string' ? search.stationId : undefined,
    lineName: typeof search.lineName === 'string' ? search.lineName : undefined,
  }),
  /*
   * Prefetch what the form renders (stations + lines). Fire-and-forget; no-op if already cached.
   * The reporting switch is prefetched here too because the form defaults to showing itself while
   * the answer is unknown — warming it on preload means a closed switch renders as the notice from
   * the first frame instead of the form flashing up and being replaced.
   */
  loader: () => {
    void queryClient.prefetchQuery(stationsQueryOptions());
    void queryClient.prefetchQuery(linesQueryOptions());
    void queryClient.prefetchQuery(configQueryOptions());
  },
  component: ReportForm,
});
