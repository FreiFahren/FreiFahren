import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { SettingsCard } from '@/components/map/SettingsCard';

export const Route = createFileRoute('/_map/settings')({
  staticData: { legalDisclaimer: false },
  component: SettingsRoute,
});

function SettingsRoute() {
  const navigate = useNavigate();
  return <SettingsCard onClose={() => navigate({ to: '/' })} />;
}
