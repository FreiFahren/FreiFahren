import { useSyncExternalStore } from 'react';

import { safeLocalStorage } from '@/lib/safe-storage';

// Ids of the announcements the user has read. A tiny module store + useSyncExternalStore (like
// viewed-reports) so the bell badge and the list update together without a provider.
const STORAGE_KEY = 'readAnnouncements';

// TODO: enable before launch. While the feature is being tested, read state lives in memory only, so
// every reload shows the announcements as unread again.
const PERSIST_READ_STATE = false;

function readInitial(): ReadonlySet<string> {
  if (!PERSIST_READ_STATE) return new Set();
  try {
    const parsed: unknown = JSON.parse(safeLocalStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(
      Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

let readIds = readInitial();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markAllAnnouncementsRead(announcements: readonly { id: string }[]): void {
  const unread = announcements.filter(({ id }) => !readIds.has(id));
  if (unread.length === 0) return;
  readIds = new Set([...readIds, ...unread.map(({ id }) => id)]);
  if (PERSIST_READ_STATE) safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds]));
  for (const listener of listeners) listener();
}

export function markAnnouncementRead(announcement: { id: string }): void {
  markAllAnnouncementsRead([announcement]);
}

/**
 * Reactive: a read predicate that updates whenever the read set changes. The set is replaced rather
 * than mutated, so memoized consumers recompute exactly when it does.
 */
export function useIsAnnouncementRead(): (announcement: { id: string }) => boolean {
  const current = useSyncExternalStore(subscribe, () => readIds);
  return ({ id }) => current.has(id);
}
