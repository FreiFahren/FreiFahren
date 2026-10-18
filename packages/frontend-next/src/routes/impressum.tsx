import { createFileRoute, redirect } from '@tanstack/react-router';

import { imprintUrl } from '@/lib/privacy-policy';

// Kept so links to the old in-app page (store listings, shared links) still land on the legal notice.
export const Route = createFileRoute('/impressum')({
  staticData: { legalDisclaimer: false },
  beforeLoad: () => {
    throw redirect({ href: imprintUrl(), replace: true });
  },
});
