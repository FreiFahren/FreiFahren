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
// Something can stay unread for days, so the cue plays as one short burst at a time, not nonstop.
const ANNOUNCEMENT_BURST_EVERY_MS = 30_000;
// The first burst waits out the app's startup, when the map is still settling in.
const ANNOUNCEMENT_FIRST_BURST_DELAY_MS = 1500;

/**
 * True for one pulse cycle shortly after `enabled` turns on, then again after every pause. Off
 * while first-launch dialogs cover the map, so the first burst isn't spent behind them.
 */
export function useAnnouncementBurst(enabled: boolean): boolean {
  const [bursting, setBursting] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const burst = () => {
      setBursting(true);
      timer = setTimeout(() => {
        setBursting(false);
        timer = setTimeout(burst, ANNOUNCEMENT_BURST_EVERY_MS - ANNOUNCEMENT_PULSE_MS);
      }, ANNOUNCEMENT_PULSE_MS);
    };
    let timer = setTimeout(burst, ANNOUNCEMENT_FIRST_BURST_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setBursting(false);
    };
  }, [enabled]);
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
