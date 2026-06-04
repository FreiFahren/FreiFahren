import { createFileRoute } from '@tanstack/react-router';

import { ReportsList } from '@/components/reports/ReportsList';

export const Route = createFileRoute('/reports/stations')({
  staticData: { legalDisclaimer: true },
  component: ReportsList,
});
