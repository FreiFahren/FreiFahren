import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  announcementQueryOptions,
  announcementsQueryOptions,
  toAnnouncementLanguage,
} from '@/api/announcements';
import { useIsAnnouncementRead } from '@/lib/read-announcements';

// One cycle for every "unread" cue — the badge's ping and the bell's ring beat in time.
export const ANNOUNCEMENT_PULSE_MS = 2000;
// Something can stay unread for days, so the cue plays as one short burst a minute, not nonstop.
const ANNOUNCEMENT_BURST_EVERY_MS = 60_000;

/** True for one pulse cycle right away, then again every minute. */
export function useAnnouncementBurst(): boolean {
  const [bursting, setBursting] = useState(true);
  useEffect(() => {
    let stop = setTimeout(() => setBursting(false), ANNOUNCEMENT_PULSE_MS);
    const every = setInterval(() => {
      setBursting(true);
      stop = setTimeout(() => setBursting(false), ANNOUNCEMENT_PULSE_MS);
    }, ANNOUNCEMENT_BURST_EVERY_MS);
    return () => {
      clearInterval(every);
      clearTimeout(stop);
    };
  }, []);
  return bursting;
}

export function useAnnouncementLanguage() {
  const { i18n } = useTranslation();
  return toAnnouncementLanguage(i18n.resolvedLanguage);
}

export function useAnnouncements() {
  return useQuery(announcementsQueryOptions(useAnnouncementLanguage()));
}

export function useAnnouncement(id: string) {
  return useQuery(announcementQueryOptions(id, useAnnouncementLanguage()));
}

export function useHasUnreadAnnouncements(): boolean {
  const { data } = useAnnouncements();
  const isRead = useIsAnnouncementRead();
  return data?.some((announcement) => !isRead(announcement)) ?? false;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

export function formatAnnouncementDate(publishedAt: string, language: string): string {
  let formatter = dateFormatters.get(language);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(language, { dateStyle: 'medium' });
    dateFormatters.set(language, formatter);
  }
  return formatter.format(new Date(publishedAt));
}
