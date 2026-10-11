import { createFileRoute } from '@tanstack/react-router';

import { AccountPage } from '@/components/account/account-page';

export const Route = createFileRoute('/account/')({
  staticData: { legalDisclaimer: false },
  component: AccountPage,
});
