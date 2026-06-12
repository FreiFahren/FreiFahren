import { useSyncExternalStore } from 'react';

import { track } from '@/lib/analytics';

// "Don't show again" preference. Reuse the old frontend's key so users who already
// dismissed the modal there are not nagged again after the rewrite ships.
const DISMISSED_KEY = 'contributionModalDismissed';

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
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    // Private mode / disabled storage: treat as not dismissed so the modal can still appear.
    return false;
  }
}

export function dismissContributeForever(): void {
  track('contribute_dismissed', { source });
  try {
    localStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // Ignore storage failures; closing the modal below still suppresses it for this session.
  }
  closeContributeModal();
}
