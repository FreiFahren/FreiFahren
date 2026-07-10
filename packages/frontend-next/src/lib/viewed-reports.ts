import { useSyncExternalStore } from 'react';

import { safeSessionStorage } from '@/lib/safe-storage';

// Reports the user has already looked at (by opening the report detail or the reports overview)
// stop pulsing on the map and on the overview button. Tracked by the app-wide
// `${stationId}-${timestamp}` report key and persisted in sessionStorage so the state survives
// route changes and reloads within the tab, and can be read from anywhere in the app. Lives in a
// tiny module store + useSyncExternalStore (like useRiskLayer) so the map markers and the overview
// button re-render the moment a report is marked viewed, without a provider.
const STORAGE_KEY = 'viewedReports';

function reportKey(stationId: string, timestamp: string): string {
  return `${stationId}-${timestamp}`;
}

function readInitial(): Set<string> {
  try {
    const raw = safeSessionStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((key): key is string => typeof key === 'string'));
  } catch {
    // Malformed JSON or storage unavailable (private mode): start empty for this session.
    return new Set();
  }
}

let viewed = readInitial();
const listeners = new Set<() => void>();

function getViewed(): ReadonlySet<string> {
  return viewed;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markReportViewed(stationId: string, timestamp: string): void {
  const key = reportKey(stationId, timestamp);
  if (viewed.has(key)) return;
  viewed = new Set(viewed).add(key);
  safeSessionStorage.setItem(STORAGE_KEY, JSON.stringify([...viewed]));
  for (const listener of listeners) listener();
}

/** Reactive: re-renders the caller when this specific report is marked viewed. */
export function useReportViewed(stationId: string, timestamp: string): boolean {
  return useSyncExternalStore(subscribe, () => viewed.has(reportKey(stationId, timestamp)));
}

/**
 * Reactive: a membership predicate that updates whenever any report is marked viewed. Used by the
 * reports layer to drive the `pulse` property for the whole GeoJSON source at once (the per-report
 * `useReportViewed` can't). The predicate closes over the viewed Set, which is replaced rather than
 * mutated on each change, so memoized consumers recompute exactly when it does.
 */
export function useIsReportViewed(): (stationId: string, timestamp: string) => boolean {
  const viewedSet = useSyncExternalStore(subscribe, getViewed);
  return (stationId, timestamp) => viewedSet.has(reportKey(stationId, timestamp));
}
