import { createFileRoute } from '@tanstack/react-router';

import { Impressum } from '@/components/legal/Impressum';

export const Route = createFileRoute('/impressum')({
  staticData: { legalDisclaimer: false },
  component: Impressum,
});
