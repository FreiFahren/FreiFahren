import { createFileRoute } from '@tanstack/react-router';

import { ReportsList } from '@/components/reports/ReportsList';

export const Route = createFileRoute('/reports/stations')({
  staticData: { legalDisclaimer: true },
  validateSearch: (search: Record<string, unknown>) => ({
    lineName: typeof search.lineName === 'string' ? search.lineName : undefined,
  }),
  component: ReportsList,
});
