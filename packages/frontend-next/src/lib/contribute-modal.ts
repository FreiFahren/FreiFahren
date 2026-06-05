import { useSyncExternalStore } from 'react';

// "Don't show again" preference. Reuse the old frontend's key so users who already
// dismissed the modal there are not nagged again after the rewrite ships.
const DISMISSED_KEY = 'contributionModalDismissed';

let open = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openContributeModal(): void {
  open = true;
  notify();
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
  try {
    localStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // Ignore storage failures; closing the modal below still suppresses it for this session.
  }
  closeContributeModal();
}
