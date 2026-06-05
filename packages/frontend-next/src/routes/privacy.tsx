import { createFileRoute } from '@tanstack/react-router';

import { PrivacyPolicy } from '@/components/legal/PrivacyPolicy';

export const Route = createFileRoute('/privacy')({
  staticData: { legalDisclaimer: false },
  component: PrivacyPolicy,
});
