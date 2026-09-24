import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { FullScreenPage } from '@/components/templates/full-screen-page';
import { PageHeader } from '@/components/templates/PageHeader';
import { markAnnouncementRead } from '@/lib/read-announcements';
import { Route as AnnouncementsRoute } from '@/routes/announcements/index';

import { NAMESPACE } from './announcements.i18n';
import { LoadError } from './load-error';
import {
  formatAnnouncementDate,
  useAnnouncement,
  useAnnouncementLanguage,
} from './use-announcements';

export function AnnouncementDetail({ id }: { id: string }) {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const language = useAnnouncementLanguage();
  const { data: announcement, isError, refetch } = useAnnouncement(id);

  // Opening an announcement reads it — whether from the list or a shared deep link.
  useEffect(() => {
    if (announcement) markAnnouncementRead(announcement);
  }, [announcement]);

  return (
    <FullScreenPage>
      <PageHeader title={t('title')} onBack={() => navigate({ to: AnnouncementsRoute.to })} />
      <div className="pb-safe-6 min-h-0 flex-1 overflow-y-auto">
        {isError && !announcement && <LoadError onRetry={() => void refetch()} />}
        {announcement && (
          <article className="flex flex-col gap-3 px-4 pt-2">
            <span className="text-muted-foreground text-xs">
              {formatAnnouncementDate(announcement.publishedAt, language)}
            </span>
            <h2 className="font-heading text-xl font-semibold">{announcement.title}</h2>
            <p className="text-muted-foreground text-sm">{announcement.description}</p>
            {announcement.bodyHtml && (
              <div
                className="announcement-body mt-2"
                dangerouslySetInnerHTML={{ __html: announcement.bodyHtml }}
              />
            )}
          </article>
        )}
      </div>
    </FullScreenPage>
  );
}
