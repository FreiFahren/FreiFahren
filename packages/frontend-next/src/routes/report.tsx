import { createFileRoute } from '@tanstack/react-router';

import { ReportForm } from '@/components/report/ReportForm';

export const Route = createFileRoute('/report')({
  component: ReportForm,
});
