import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import {
  announcementQueryOptions,
  announcementsQueryOptions,
  toAnnouncementLanguage,
} from '@/api/announcements';
import { useIsAnnouncementRead } from '@/lib/read-announcements';

// One cycle for every "unread" cue — the badge's ping and the bell's ring beat in time.
export const ANNOUNCEMENT_PULSE_MS = 2000;

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
