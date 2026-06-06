import { createFileRoute } from '@tanstack/react-router';

import { ReportForm } from '@/components/report/ReportForm';

type ReportSearch = { stationId?: string };

export const Route = createFileRoute('/report')({
  staticData: { legalDisclaimer: false },
  validateSearch: (search: Record<string, unknown>): ReportSearch => ({
    stationId: typeof search.stationId === 'string' ? search.stationId : undefined,
  }),
  component: ReportForm,
});
