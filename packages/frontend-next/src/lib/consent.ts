import { useSyncExternalStore } from 'react';

import { enqueuePostHog, PERSISTENT_PERSISTENCE } from '@/lib/posthog-client';
import { safeLocalStorage } from '@/lib/safe-storage';

// Capture is ON by default (see main.tsx). The banner asks for cookie consent specifically; either
// choice keeps analytics running, but at different privacy levels:
// - null (undecided): init default — persistent capture (cookie/localStorage), full retention/funnels.
// - 'granted': allow cookies — persistent capture, recognizes returning visits.
// - 'denied': decline cookies — switch to cookieless (in-memory) capture. Anonymous events still
//   flow, but nothing is stored on the device and each session looks new. A full opt-out (no events
//   at all) is available via the browser's Do Not Track signal (respect_dnt in main.tsx).
export type ConsentChoice = 'granted' | 'denied';

const STORAGE_KEY = 'analyticsConsent';
// Re-ask after this long so a stored choice doesn't last forever. ~3 months re-engages users
// without nagging (a longer window would be even safer). The last choice still drives PostHog
// until the user actually re-decides; only the prompt reappears.
const REPROMPT_MS = 1000 * 60 * 60 * 24 * 91;

type StoredConsent = { choice: ConsentChoice; decidedAt: number };

function read(): StoredConsent | null {
  try {
    const raw = safeLocalStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'choice' in parsed &&
      'decidedAt' in parsed
    ) {
      const { choice: c, decidedAt: d } = parsed as Record<string, unknown>;
      const t = typeof d === 'string' ? new Date(d).getTime() : NaN;
      if ((c === 'granted' || c === 'denied') && !Number.isNaN(t)) {
        return { choice: c, decidedAt: t };
      }
    }
    return null;
  } catch {
    // Malformed or legacy values are treated as undecided.
    return null;
  }
}

const stored = read();
let choice: ConsentChoice | null = stored?.choice ?? null;
let decidedAt: number | null = stored?.decidedAt ?? null;

// True when no choice has been made yet, or the stored choice is older than the re-prompt window.
function needsPrompt(): boolean {
  if (choice === null || decidedAt === null) return true;
  return Date.now() - decidedAt >= REPROMPT_MS;
}

// On-demand "review" state so the banner can be reopened from settings to change the choice,
// independent of the first-run prompt. Mirrors the legal-disclaimer review flag.
let reviewOpen = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Bring PostHog in line with the current choice. Safe to call before a decision is made.
// Every branch also stamps the choice as a super-property so traffic can be split by consent
// state: 'denied' users get a fresh anonymous id each visit and can never register as "returned",
// so a breakdown on `cookie_consent` sizes that retention blind spot and lets retention be read
// cleanly on the non-'denied' slice. The value rides along in memory for 'denied' sessions, which
// is exactly the slice we want to count, so it stays readable without cookies.
function applyToPostHog(value: ConsentChoice | null): void {
  // Ops buffer until the lazily-loaded SDK is ready.
  if (value === 'denied') {
    // Cookieless: keep capturing but store nothing on the device. reset() clears any id/cookie set
    // earlier (e.g. while undecided) so declining cookies genuinely leaves no device storage.
    enqueuePostHog((posthog) => {
      posthog.reset();
      posthog.set_config({ persistence: 'memory' });
      // register() after reset() so the super-property survives the clear (in memory for this session).
      posthog.register({ cookie_consent: 'denied', persistence_mode: 'memory' });
    });
  } else if (value === 'granted') {
    enqueuePostHog((posthog) => {
      posthog.set_config({ persistence: PERSISTENT_PERSISTENCE });
      posthog.opt_in_capturing();
      posthog.register({ cookie_consent: 'granted', persistence_mode: PERSISTENT_PERSISTENCE });
    });
  } else {
    // null: leave PostHog in its init default (persistent capture), just label the slice.
    enqueuePostHog((posthog) => {
      posthog.register({ cookie_consent: 'undecided', persistence_mode: PERSISTENT_PERSISTENCE });
    });
  }
}

export function setConsent(value: ConsentChoice): void {
  const now = new Date();
  decidedAt = now.getTime();
  safeLocalStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ choice: value, decidedAt: now.toISOString() }),
  );
  choice = value;
  reviewOpen = false;
  applyToPostHog(value);
  notify();
}

// Reapply a returning visitor's stored choice to PostHog. Called once after the SDK initializes.
export function syncConsentToPostHog(): void {
  applyToPostHog(choice);
}

export function openConsentSettings(): void {
  reviewOpen = true;
  notify();
}

export function closeConsentSettings(): void {
  reviewOpen = false;
  notify();
}

export function getConsent(): ConsentChoice | null {
  return choice;
}

export function useConsent(): ConsentChoice | null {
  return useSyncExternalStore(subscribe, () => choice);
}

// Whether the first-run/expired prompt should be shown (no decision yet, or older than the window).
export function useConsentPrompt(): boolean {
  return useSyncExternalStore(subscribe, needsPrompt);
}

export function useConsentReview(): boolean {
  return useSyncExternalStore(subscribe, () => reviewOpen);
}
