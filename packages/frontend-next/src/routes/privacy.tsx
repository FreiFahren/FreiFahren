import { createFileRoute, redirect } from '@tanstack/react-router';

import { privacyPolicyUrl } from '@/lib/privacy-policy';

// Kept so links to the old in-app page (store listings, shared links) still land on the policy.
export const Route = createFileRoute('/privacy')({
  staticData: { legalDisclaimer: false },
  beforeLoad: () => {
    throw redirect({ href: privacyPolicyUrl(), replace: true });
  },
});
