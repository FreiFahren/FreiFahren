import { useSyncExternalStore } from 'react';

import { restoreNativePreference, saveNativePreference } from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';

// localStorage has no native expiry, so keep the acceptance timestamp and expire it ourselves.
const STORAGE_KEY = 'legalDisclaimerAcceptedAt';
const ACCEPTANCE_WINDOW_MS = 1000 * 60 * 60 * 24;

function acceptedAt(): number | null {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  const timestamp = new Date(raw).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

let accepted = false;
// The disclaimer doubles as the Terms of Use, openable on demand even after acceptance.
let reviewOpen = false;
const listeners = new Set<() => void>();
let expirationTimer: ReturnType<typeof setTimeout> | undefined;

function notify(): void {
  for (const listener of listeners) listener();
}

function scheduleExpiration(timestamp: number): void {
  clearTimeout(expirationTimer);
  const elapsed = Date.now() - timestamp;
  const remaining = ACCEPTANCE_WINDOW_MS - elapsed;
  accepted = elapsed >= 0 && remaining > 0;
  if (!accepted) return;
  expirationTimer = setTimeout(() => {
    accepted = false;
    notify();
  }, remaining);
}

const storedAcceptance = acceptedAt();
if (storedAcceptance !== null) scheduleExpiration(storedAcceptance);

export function acceptLegalDisclaimer(): void {
  const now = Date.now();
  void saveNativePreference(STORAGE_KEY, new Date(now).toISOString());
  scheduleExpiration(now);
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
