import { useSyncExternalStore } from 'react';

import { restoreNativePreference, saveNativePreference } from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';

// Ids of the announcements the user has read. A tiny module store + useSyncExternalStore (like
// viewed-reports) so the bell badge and the list update together without a provider. Mirrored to
// native Preferences so a WebView storage purge doesn't bring every announcement back as unread.
const STORAGE_KEY = 'readAnnouncements';

function readInitial(): ReadonlySet<string> {
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

function notify(): void {
  for (const listener of listeners) listener();
}

// The store is reactive, so a purged copy is recovered in place rather than with a reload.
void restoreNativePreference(STORAGE_KEY).then((restored) => {
  if (!restored) return;
  readIds = readInitial();
  notify();
});

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markAllAnnouncementsRead(announcements: readonly { id: string }[]): void {
  const unread = announcements.filter(({ id }) => !readIds.has(id));
  if (unread.length === 0) return;
  readIds = new Set([...readIds, ...unread.map(({ id }) => id)]);
  void saveNativePreference(STORAGE_KEY, JSON.stringify([...readIds]));
  notify();
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
