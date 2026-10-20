import { queryOptions, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchFund, FundRequestError } from '@/lib/fund-api';
import { safeLocalStorage } from '@/lib/safe-storage';

export type Membership = {
  status: 'none' | 'pending' | 'active' | 'past_due' | 'canceled';
  legalName: string | null;
  amountCents: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  // Why the auth-worker would refuse to delete the account, since Stripe can still charge it.
  accountDeletionBlockedBy: 'membership' | 'overdue_payment' | 'unfinished_signup' | null;
};

export const membershipQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['fund', userId, 'membership'],
    queryFn: async ({ signal }): Promise<Membership> =>
      (await fetchFund('/membership', { signal })).json(),
    // It carries the legal name, and must be fresh when someone comes back from Stripe.
    meta: { persist: false },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

export const useMembership = (userId: string) => useQuery(membershipQueryOptions(userId));

/*
 * Opens Stripe's hosted Checkout or billing portal, which send people back to `/fund`, or to the
 * account page for the portal with `returnTo`. The native app hands it to the browser; Stripe can't
 * return to its WebView, so membership refetches on focus.
 */
export async function openStripe(
  path: '/checkout-sessions' | '/billing-portal-sessions',
  { body, returnTo }: { body?: { amountCents: number }; returnTo?: 'account' } = {},
) {
  const response = await fetchFund(returnTo === undefined ? path : `${path}?returnTo=${returnTo}`, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const { url } = (await response.json()) as { url: string };
  // In the native app, Capacitor hands navigation to another domain over to Safari.
  window.location.assign(url);
}

export function useOpenStripe(onAlreadyMember?: () => void) {
  const [state, setState] = useState<'idle' | 'opening' | 'failed'>('idle');
  const open = async (...args: Parameters<typeof openStripe>) => {
    setState('opening');
    try {
      await openStripe(...args);
      setState('idle');
    } catch (err) {
      if (err instanceof FundRequestError && err.status === 409 && onAlreadyMember)
        onAlreadyMember();
      setState('failed');
    }
  };
  return { state, open };
}

export function useEuro() {
  const { i18n } = useTranslation();
  return (cents: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
}

const seenKey = (userId: string) => `fund-rules-seen-${userId}`;

// Members confirm the rules once on this device before they see the Fund page.
export const rulesSeen = (userId: string) => safeLocalStorage.getItem(seenKey(userId)) !== null;
export const markRulesSeen = (userId: string) => safeLocalStorage.setItem(seenKey(userId), '1');
