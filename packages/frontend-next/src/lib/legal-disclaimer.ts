import { useSyncExternalStore } from 'react';

import { restoreNativePreference, saveNativePreference } from '@/lib/native-preference';
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
// The disclaimer doubles as the Terms of Use, openable on demand even after acceptance.
let reviewOpen = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function acceptLegalDisclaimer(): void {
  void saveNativePreference(STORAGE_KEY, new Date().toISOString());
  accepted = true;
  notify();
}

export function isLegalDisclaimerAccepted(): boolean {
  return accepted;
}

export function restoreLegalAcceptance(): Promise<boolean> {
  return restoreNativePreference(STORAGE_KEY);
}

export function subscribeLegalDisclaimer(listener: () => void): () => void {
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

export function useLegalDisclaimerReview(): boolean {
  return useSyncExternalStore(subscribeLegalDisclaimer, () => reviewOpen);
}
