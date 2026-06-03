import { createFileRoute } from '@tanstack/react-router';

import { ReportsSummary } from '@/components/reports/ReportsSummary';

export const Route = createFileRoute('/reports/')({
  component: ReportsSummary,
});
