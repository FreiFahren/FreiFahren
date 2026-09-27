import { createFileRoute } from '@tanstack/react-router';

import { AnnouncementDetail } from '@/components/announcements/announcement-detail';

export const Route = createFileRoute('/announcements/$announcementId')({
  staticData: { legalDisclaimer: false },
  component: AnnouncementDetailRoute,
});

function AnnouncementDetailRoute() {
  const { announcementId } = Route.useParams();
  return <AnnouncementDetail id={announcementId} />;
}
