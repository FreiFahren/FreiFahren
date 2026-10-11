import { safeSessionStorage } from '@/lib/safe-storage';

/*
 * The emailed account-deletion link carries a token that deletes the account, in the URL fragment so
 * it never reaches a server log. It would still be in location.href, which pageviews, every PostHog
 * event and Sentry all record, so it moves into session storage before any of them start: this
 * module is main.tsx's first import. Session storage keeps it across a reload of the page.
 */
const STORAGE_KEY = 'freifahren-account-deletion-token';
// Plain string rather than the route's `to`: importing the route here would load it before Sentry.
const DELETE_PAGE_PATH = '/account/delete';

const fromFragment = new URLSearchParams(window.location.hash.slice(1)).get('token');
if (window.location.pathname === DELETE_PAGE_PATH && fromFragment) {
  safeSessionStorage.setItem(STORAGE_KEY, fromFragment);
  window.history.replaceState(window.history.state, '', window.location.pathname);
}

export function getDeletionToken(): string | undefined {
  return safeSessionStorage.getItem(STORAGE_KEY) ?? undefined;
}

export function forgetDeletionToken(): void {
  safeSessionStorage.removeItem(STORAGE_KEY);
}
