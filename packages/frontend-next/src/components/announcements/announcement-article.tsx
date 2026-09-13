import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { track } from '@/lib/analytics';
import type { AnnouncementWithBody } from '@/lib/announcements';
import { markAnnouncementRead } from '@/lib/read-announcements';

import { NAMESPACE } from './announcements.i18n';

export function AnnouncementArticle({ announcement }: { announcement: AnnouncementWithBody }) {
  const { i18n } = useTranslation(NAMESPACE);

  useEffect(() => {
    markAnnouncementRead(announcement.slug);
    track('announcement_viewed', { slug: announcement.slug });
  }, [announcement.slug]);

  const date = new Intl.DateTimeFormat(i18n.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(announcement.date));

  return (
    <article className="px-4 pt-1 pb-8">
      <p className="text-muted-foreground text-[11px]">{date}</p>
      <h2 className="font-heading mt-1 text-lg font-semibold">{announcement.title}</h2>
      <p className="text-muted-foreground mt-2 text-sm/relaxed font-semibold">
        {announcement.description}
      </p>
      {/*
       * Safe to inject only because the HTML is built from a markdown file in this repo, reviewed
       * like any other source. Nothing user-submitted may ever be routed through here.
       */}
      <div
        className="[&_a]:text-accent-bright [&_h2]:font-heading [&_ol]:text-muted-foreground [&_ul]:text-muted-foreground mt-4 text-sm/relaxed [&_a]:underline [&_h2]:mt-5 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mt-3 [&_p:first-child]:mt-0 [&_strong]:font-semibold [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-4"
        dangerouslySetInnerHTML={{ __html: announcement.html }}
      />
    </article>
  );
}
