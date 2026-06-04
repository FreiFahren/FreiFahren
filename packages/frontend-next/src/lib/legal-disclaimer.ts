import { useSyncExternalStore } from 'react';

// Acceptance is re-asked every six months. localStorage has no native expiry, so
// we store the acceptance timestamp and compare against this window on read.
// (Note: on Safari/iOS, ITP may purge script-writable storage after ~7 days of
// no interaction, which can surface the disclaimer sooner than six months for
// infrequent visitors — acceptable here, since erring toward showing it is the
// legally safe direction.)
const STORAGE_KEY = 'legalDisclaimerAcceptedAt';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;

function isWithinWindow(now: number): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return false;
    const acceptedAt = new Date(raw).getTime();
    if (Number.isNaN(acceptedAt)) return false;
    return now - acceptedAt < SIX_MONTHS_MS;
  } catch {
    // Private mode / disabled storage: treat as not accepted so the gate still works.
    return false;
  }
}

let accepted = isWithinWindow(Date.now());
const listeners = new Set<() => void>();

function acceptDisclaimer(): void {
  try {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // Ignore storage failures; the session-level state below still suppresses the gate.
  }
  accepted = true;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLegalDisclaimer(): { accepted: boolean; accept: () => void } {
  const value = useSyncExternalStore(subscribe, () => accepted);
  return { accepted: value, accept: acceptDisclaimer };
}
