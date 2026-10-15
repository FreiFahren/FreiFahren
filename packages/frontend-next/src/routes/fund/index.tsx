import { createFileRoute } from '@tanstack/react-router';

import { FundPage } from '@/components/fund/fund-page';

export const Route = createFileRoute('/fund/')({
  staticData: { legalDisclaimer: false },
  component: FundPage,
});
