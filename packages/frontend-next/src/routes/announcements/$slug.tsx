import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { AnnouncementArticle } from '@/components/announcements/announcement-article';
import { NAMESPACE } from '@/components/announcements/announcements.i18n';
import { PageHeader } from '@/components/templates/PageHeader';
import { loadAnnouncement } from '@/lib/announcements';
import { FEATURE_FLAGS, getFeatureFlag } from '@/lib/feature-flags';

export const Route = createFileRoute('/announcements/$slug')({
  // The URL is reachable without the button, so the route gates too.
  beforeLoad: () => {
    if (!getFeatureFlag(FEATURE_FLAGS.announcements)) throw redirect({ to: '/', replace: true });
  },
  staticData: { legalDisclaimer: false },
  loader: async ({ params }) => {
    const announcement = await loadAnnouncement(params.slug);
    // A body-less announcement is as dead an end here as an unknown slug.
    if (!announcement) throw redirect({ to: '/announcements', replace: true });
    return { announcement };
  },
  component: AnnouncementRoute,
});

function AnnouncementRoute() {
  const { t } = useTranslation(NAMESPACE);
  const { announcement } = Route.useLoaderData();
  const navigate = useNavigate();

  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <PageHeader title={t('title')} onBack={() => navigate({ to: '/announcements' })} />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnnouncementArticle announcement={announcement} />
        </div>
      </div>
    </div>
  );
}
