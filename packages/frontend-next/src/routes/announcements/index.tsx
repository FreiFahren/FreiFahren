import { createFileRoute } from '@tanstack/react-router';

import { AnnouncementsList } from '@/components/announcements/announcements-list';

export const Route = createFileRoute('/announcements/')({
  staticData: { legalDisclaimer: false },
  component: AnnouncementsList,
});
