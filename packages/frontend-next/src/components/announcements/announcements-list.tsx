import { Link, useNavigate } from '@tanstack/react-router';
import { Check, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { AnnouncementSummary } from '@/api/announcements';
import { FullScreenPage } from '@/components/templates/full-screen-page';
import { PageHeader } from '@/components/templates/PageHeader';
import { Button } from '@/components/ui/button';
import { PulseDot } from '@/components/ui/pulse-dot';
import {
  markAllAnnouncementsRead,
  markAnnouncementRead,
  useIsAnnouncementRead,
} from '@/lib/read-announcements';
import { Route as MapIndexRoute } from '@/routes/_map/index';
import { Route as AnnouncementDetailRoute } from '@/routes/announcements/$announcementId';

import { NAMESPACE } from './announcements.i18n';
import { LoadError } from './load-error';
import {
  ANNOUNCEMENT_PULSE_MS,
  formatAnnouncementDate,
  useAnnouncementLanguage,
  useAnnouncements,
} from './use-announcements';

function AnnouncementRow({
  announcement,
  unread,
}: {
  announcement: AnnouncementSummary;
  unread: boolean;
}) {
  const { t } = useTranslation(NAMESPACE);
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
      {unread ? (
        <PulseDot cycleMs={ANNOUNCEMENT_PULSE_MS} className="mt-1.5" />
      ) : (
        <span className="size-2 shrink-0" />
      )}
      {announcement.hasBody ? (
        // The detail page marks the announcement read on open, which also covers deep links.
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
      {unread && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('markRead')}
          className="text-muted-foreground hover:text-foreground -mt-1 -mr-2"
          onClick={() => markAnnouncementRead(announcement)}
        >
          <Check />
        </Button>
      )}
    </li>
  );
}

export function AnnouncementsList() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const { data: announcements = [], isPending, isError, refetch } = useAnnouncements();
  const isRead = useIsAnnouncementRead();

  const anyUnread = announcements.some((announcement) => !isRead(announcement));

  return (
    <FullScreenPage>
      <PageHeader
        title={t('title')}
        onBack={() => navigate({ to: MapIndexRoute.to })}
        action={
          <Button
            variant="ghost"
            size="xs"
            disabled={!anyUnread}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => markAllAnnouncementsRead(announcements)}
          >
            <Check />
            {t('markAllRead')}
          </Button>
        }
      />
      <div className="pb-safe-6 min-h-0 flex-1 overflow-y-auto">
        {isError && announcements.length === 0 ? (
          <LoadError onRetry={() => void refetch()} />
        ) : !isPending && announcements.length === 0 ? (
          <p className="text-muted-foreground px-4 py-10 text-center text-sm">{t('empty')}</p>
        ) : (
          <ul className="divide-border-soft divide-y">
            {announcements.map((announcement) => (
              <AnnouncementRow
                key={announcement.id}
                announcement={announcement}
                unread={!isRead(announcement)}
              />
            ))}
          </ul>
        )}
      </div>
    </FullScreenPage>
  );
}
