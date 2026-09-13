import { Link } from '@tanstack/react-router';
import { Check, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { type Announcement, useAnnouncements } from '@/lib/announcements';
import {
  markAnnouncementRead,
  markAnnouncementsRead,
  useAnnouncementRead,
  useUnreadAnnouncementCount,
} from '@/lib/read-announcements';
import { cn } from '@/lib/utils';
import { Route as AnnouncementRoute } from '@/routes/announcements/$slug';

import { NAMESPACE } from './announcements.i18n';

const ROW_CLASS = 'flex w-full items-center gap-3 px-4 py-3 text-left';

function AnnouncementRow({ announcement }: { announcement: Announcement }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const isRead = useAnnouncementRead(announcement.slug);

  const date = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(announcement.date));

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {!isRead && (
            <span
              aria-label={t('unread')}
              className="bg-destructive block size-1.5 shrink-0 rounded-full"
            />
          )}
          <span className="truncate text-sm font-semibold">{announcement.title}</span>
        </div>
        <p className="text-muted-foreground mt-1 text-xs/relaxed">{announcement.description}</p>
        <p className="text-muted-foreground mt-1 text-[11px]">{date}</p>
      </div>
      {announcement.hasBody && <ChevronRight className="text-muted-foreground size-4 shrink-0" />}
    </>
  );

  return (
    <li className="border-border/60 flex items-center border-b pr-2">
      {announcement.hasBody ? (
        <Link
          to={AnnouncementRoute.to}
          params={{ slug: announcement.slug }}
          className={cn(ROW_CLASS, 'hover:bg-muted focus-visible:bg-muted outline-none')}
        >
          {body}
        </Link>
      ) : (
        <div className={ROW_CLASS}>{body}</div>
      )}
      {!isRead && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('markRead')}
          title={t('markRead')}
          onClick={() => markAnnouncementRead(announcement.slug)}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <Check />
        </Button>
      )}
    </li>
  );
}

export function AnnouncementsList() {
  const { t } = useTranslation(NAMESPACE);
  const announcements = useAnnouncements();

  if (announcements.length === 0) {
    return <p className="text-muted-foreground px-4 py-6 text-sm">{t('empty')}</p>;
  }

  return (
    <ul>
      {announcements.map((announcement) => (
        <AnnouncementRow key={announcement.slug} announcement={announcement} />
      ))}
    </ul>
  );
}

export function MarkAllReadButton() {
  const { t } = useTranslation(NAMESPACE);
  const announcements = useAnnouncements();
  const unreadCount = useUnreadAnnouncementCount();

  if (unreadCount === 0) return null;

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => markAnnouncementsRead(announcements.map(({ slug }) => slug))}
      className="text-muted-foreground hover:text-foreground"
    >
      {t('markAllRead')}
    </Button>
  );
}
