import { createFileRoute } from '@tanstack/react-router';

import { MembershipPage } from '@/components/account/membership-page';

export const Route = createFileRoute('/account/membership')({
  staticData: { legalDisclaimer: false },
  component: MembershipPage,
});
