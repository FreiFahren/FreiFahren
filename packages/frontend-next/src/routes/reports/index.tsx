import { createFileRoute } from '@tanstack/react-router';

import { ReportsSummary } from '@/components/reports/ReportsSummary';

export const Route = createFileRoute('/reports/')({
  staticData: { legalDisclaimer: true },
  component: ReportsSummary,
});
