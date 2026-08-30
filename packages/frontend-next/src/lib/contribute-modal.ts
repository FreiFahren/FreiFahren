import { useSyncExternalStore } from 'react';

import { track } from '@/lib/analytics';
import { safeLocalStorage } from '@/lib/safe-storage';

// "Don't show again" preference. Reuse the old frontend's key so users who already
// dismissed the modal there are not nagged again after the rewrite ships.
const DISMISSED_KEY = 'contributionModalDismissed';
const LAST_SHOWN_KEY = 'contributionModalLastShownAt';
const REPORT_SUCCESS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// Which entry point opened the modal, carried through to the contribution analytics events.
export type ContributeSource = 'settings' | 'report_success';

let open = false;
let source: ContributeSource = 'settings';
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openContributeModal(from: ContributeSource): void {
  source = from;
  open = true;
  notify();
  track('contribute_modal_opened', { source: from });
}

export function getContributeSource(): ContributeSource {
  return source;
}

export function closeContributeModal(): void {
  open = false;
  notify();
}

export function useContributeModalOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}

export function isContributeDismissed(): boolean {
  return safeLocalStorage.getItem(DISMISSED_KEY) === 'true';
}

export function dismissContributeForever(): void {
  track('contribute_dismissed', { source });
  safeLocalStorage.setItem(DISMISSED_KEY, 'true');
  closeContributeModal();
}

export function shouldOpenContributeAfterReport(variant: 'control' | 'test' | false): boolean {
  if (isContributeDismissed()) return false;
  if (variant !== 'test') return true;
  const raw = safeLocalStorage.getItem(LAST_SHOWN_KEY);
  if (raw === null) return true;
  const lastShownAt = Number(raw);
  if (!Number.isFinite(lastShownAt)) return true;
  return Date.now() - lastShownAt >= REPORT_SUCCESS_COOLDOWN_MS;
}

export function markContributeShownAfterReport(): void {
  safeLocalStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
}
