import { createFileRoute } from '@tanstack/react-router';

import { ReportsList } from '@/components/reports/ReportsList';

export const Route = createFileRoute('/_map/reports/_overview/stations')({
  component: ReportsList,
});
