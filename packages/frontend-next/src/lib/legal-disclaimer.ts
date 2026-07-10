import { useSyncExternalStore } from 'react';

import { safeLocalStorage } from '@/lib/safe-storage';

// Acceptance is re-asked every six months. localStorage has no native expiry, so
// we store the acceptance timestamp and compare against this window on read.
// (Note: on Safari/iOS, ITP may purge script-writable storage after ~7 days of
// no interaction, which can surface the disclaimer sooner than six months for
// infrequent visitors — acceptable here, since erring toward showing it is the
// legally safe direction.)
const STORAGE_KEY = 'legalDisclaimerAcceptedAt';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 182;

function isWithinWindow(now: number): boolean {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  if (raw === null) return false;
  const acceptedAt = new Date(raw).getTime();
  if (Number.isNaN(acceptedAt)) return false;
  return now - acceptedAt < SIX_MONTHS_MS;
}

let accepted = isWithinWindow(Date.now());
// On-demand "review" state: the disclaimer doubles as the Terms of Use, openable from a link
// even after acceptance. Independent of the route-driven consent gate.
let reviewOpen = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function acceptDisclaimer(): void {
  safeLocalStorage.setItem(STORAGE_KEY, new Date().toISOString());
  accepted = true;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openLegalDisclaimer(): void {
  reviewOpen = true;
  notify();
}

export function closeLegalDisclaimer(): void {
  reviewOpen = false;
  notify();
}

export function useLegalDisclaimer(): { accepted: boolean; accept: () => void } {
  const value = useSyncExternalStore(subscribe, () => accepted);
  return { accepted: value, accept: acceptDisclaimer };
}

export function useLegalDisclaimerReview(): boolean {
  return useSyncExternalStore(subscribe, () => reviewOpen);
}
