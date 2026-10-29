import { createFileRoute } from '@tanstack/react-router';

import { FineDetailsPage } from '@/components/fund/fine-details';

export const Route = createFileRoute('/fund/$fineId')({
  staticData: { legalDisclaimer: false },
  component: FineDetailsRoute,
});

function FineDetailsRoute() {
  const { fineId } = Route.useParams();
  return <FineDetailsPage fineId={fineId} />;
}
