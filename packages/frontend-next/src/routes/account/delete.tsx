import { createFileRoute } from '@tanstack/react-router';

import { DeleteAccountPage } from '@/components/account/delete-account-page';

export const Route = createFileRoute('/account/delete')({
  staticData: { legalDisclaimer: false },
  component: DeleteAccountPage,
});
