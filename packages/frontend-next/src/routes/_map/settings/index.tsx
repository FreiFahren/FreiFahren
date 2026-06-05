import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { SettingsCard } from '@/components/map/SettingsCard';
import { Route as MapIndexRoute } from '@/routes/_map/index';

export const Route = createFileRoute('/_map/settings/')({
  staticData: { legalDisclaimer: false },
  component: SettingsRoute,
});

function SettingsRoute() {
  const navigate = useNavigate();
  return <SettingsCard onClose={() => navigate({ to: MapIndexRoute.to })} />;
}
