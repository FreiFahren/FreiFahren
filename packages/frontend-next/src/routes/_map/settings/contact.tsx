import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { ContactCard } from '@/components/map/ContactCard';
import { Route as SettingsIndexRoute } from '@/routes/_map/settings/index';

export const Route = createFileRoute('/_map/settings/contact')({
  staticData: { legalDisclaimer: false },
  component: ContactRoute,
});

function ContactRoute() {
  const navigate = useNavigate();
  return <ContactCard onClose={() => navigate({ to: SettingsIndexRoute.to })} />;
}
