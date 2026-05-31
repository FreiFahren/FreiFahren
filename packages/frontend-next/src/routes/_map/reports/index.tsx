import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { DetailCard } from '@/components/map/DetailCard';
import { CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/_map/reports/')({
  component: ReportsOverviewRoute,
});

function ReportsOverviewRoute() {
  const navigate = useNavigate();
  return (
    <DetailCard title="Reports" closeLabel="Close" onClose={() => navigate({ to: '/' })}>
      <CardContent className="text-muted-foreground text-sm">
        Reports overview coming soon.
      </CardContent>
    </DetailCard>
  );
}
