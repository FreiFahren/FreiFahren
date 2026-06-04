import { createFileRoute } from '@tanstack/react-router';

import { LinesChart } from '@/components/reports/LinesChart';

export const Route = createFileRoute('/reports/lines')({
  staticData: { legalDisclaimer: true },
  component: LinesChart,
});
