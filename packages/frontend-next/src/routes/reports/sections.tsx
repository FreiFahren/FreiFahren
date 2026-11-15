import { createFileRoute } from '@tanstack/react-router';

import { SectionsList } from '@/components/reports/sections-list';

export const Route = createFileRoute('/reports/sections')({
  staticData: { legalDisclaimer: true },
  component: SectionsList,
});
