import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AnnouncementSummary } from '@/api/announcements';
import { FullScreenPage } from '@/components/templates/full-screen-page';
import { PageHeader } from '@/components/templates/PageHeader';
import { PulseDot } from '@/components/ui/pulse-dot';
import { getReadAnnouncementIds, markAllAnnouncementsRead } from '@/lib/read-announcements';
import { Route as MapIndexRoute } from '@/routes/_map/index';
import { Route as AnnouncementDetailRoute } from '@/routes/announcements/$announcementId';

import { NAMESPACE } from './announcements.i18n';
import { LoadError } from './load-error';
import {
  formatAnnouncementDate,
  useAnnouncementLanguage,
  useAnnouncements,
} from './use-announcements';

function AnnouncementRow({
  announcement,
  isNew,
}: {
  announcement: AnnouncementSummary;
  isNew: boolean;
}) {
  const language = useAnnouncementLanguage();

  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-muted-foreground text-xs">
          {formatAnnouncementDate(announcement.publishedAt, language)}
        </span>
        <span className="text-sm font-semibold">{announcement.title}</span>
        <span className="text-muted-foreground text-sm">{announcement.description}</span>
      </span>
      {announcement.hasBody && (
        <ChevronRight className="text-muted-foreground size-4 shrink-0 self-center" />
      )}
    </>
  );

  return (
    <li className="flex items-start gap-2 px-4 py-3">
      {isNew ? <PulseDot pulse={false} className="mt-1.5" /> : <span className="size-2 shrink-0" />}
      {announcement.hasBody ? (
        <Link
          to={AnnouncementDetailRoute.to}
          params={{ announcementId: announcement.id }}
          className="-my-1 flex min-w-0 flex-1 gap-2 rounded-md py-1"
        >
          {content}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 gap-2">{content}</div>
      )}
    </li>
  );
}

export function AnnouncementsList() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const { data: announcements, isPending, isError, refetch } = useAnnouncements();
  // Read state as the page opened, so rows keep showing what's new after everything is marked read.
  const [readOnOpen] = useState(getReadAnnouncementIds);

  // Opening the page reads everything it lists; that alone clears the bell.
  useEffect(() => {
    if (announcements) markAllAnnouncementsRead(announcements);
  }, [announcements]);

  return (
    <FullScreenPage>
      <PageHeader title={t('title')} onBack={() => navigate({ to: MapIndexRoute.to })} />
      <div className="pb-safe-6 min-h-0 flex-1 overflow-y-auto">
        {isError && !announcements ? (
          <LoadError onRetry={() => void refetch()} />
        ) : !isPending && announcements?.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">{t('empty')}</p>
        ) : (
          <ul className="divide-border-soft divide-y">
            {announcements?.map((announcement) => (
              <AnnouncementRow
                key={announcement.id}
                announcement={announcement}
                isNew={!readOnOpen.has(announcement.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </FullScreenPage>
  );
}
