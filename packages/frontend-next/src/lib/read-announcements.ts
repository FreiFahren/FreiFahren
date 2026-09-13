import { useSyncExternalStore } from 'react';

import { publishedAnnouncementSlugs, useAnnouncements } from '@/lib/announcements';
import { saveNativePreference } from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';

// Read announcements by slug. localStorage rather than the sessionStorage viewed-reports uses, so
// it survives closing the app, and mirrored to native Preferences against WebView purges.
const STORAGE_KEY = 'readAnnouncements';

function persist(slugs: ReadonlySet<string>): void {
  void saveNativePreference(STORAGE_KEY, JSON.stringify([...slugs]));
}

function readInitial(): Set<string> {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);

  // First run: seed as read, so a new user isn't met by a badge over the whole back catalogue.
  if (raw === null) {
    const seeded = new Set(publishedAnnouncementSlugs());
    persist(seeded);
    return seeded;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((slug): slug is string => typeof slug === 'string'));
  } catch {
    return new Set();
  }
}

let read = readInitial();
const listeners = new Set<() => void>();

function getRead(): ReadonlySet<string> {
  return read;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markAnnouncementsRead(slugs: readonly string[]): void {
  const unread = slugs.filter((slug) => !read.has(slug));
  if (unread.length === 0) return;

  const next = new Set(read);
  for (const slug of unread) next.add(slug);
  read = next;
  persist(read);
  for (const listener of listeners) listener();
}

export function markAnnouncementRead(slug: string): void {
  markAnnouncementsRead([slug]);
}

export function useAnnouncementRead(slug: string): boolean {
  return useSyncExternalStore(subscribe, () => read.has(slug));
}

export function useUnreadAnnouncementCount(): number {
  const announcements = useAnnouncements();
  const readSlugs = useSyncExternalStore(subscribe, getRead);
  return announcements.filter((announcement) => !readSlugs.has(announcement.slug)).length;
}
