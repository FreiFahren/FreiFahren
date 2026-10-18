import { Capacitor } from '@capacitor/core';
import { useQuery } from '@tanstack/react-query';

import { fetchFund } from '@/lib/fund-api';

export type Membership = {
  status: 'none' | 'pending' | 'active' | 'past_due' | 'canceled';
  legalName: string | null;
  amountCents: number | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export function useMembership(userId: string) {
  return useQuery({
    queryKey: ['fund', userId, 'membership'],
    queryFn: async ({ signal }): Promise<Membership> =>
      (await fetchFund('/membership', { signal })).json(),
    // It carries the legal name, and must be fresh when someone comes back from Stripe.
    meta: { persist: false },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/*
 * Opens Stripe's hosted Checkout or billing portal, which send people back to `/fund`. The native
 * app hands it to the browser; Stripe can't return to its WebView, so membership refetches on focus.
 */
export async function openStripe(
  path: '/checkout-sessions' | '/billing-portal-sessions',
  body?: { amountCents: number },
) {
  const response = await fetchFund(path, {
    method: 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const { url } = (await response.json()) as { url: string };
  if (Capacitor.isNativePlatform()) window.open(url, '_blank');
  else window.location.assign(url);
}
