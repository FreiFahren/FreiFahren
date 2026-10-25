import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SECONDARY_BUTTON } from '@/components/account/account-layout';
import { Button } from '@/components/ui/button';
import { useFundEnabled } from '@/hooks/use-fund-enabled';
import { useMembership, useOpenStripe } from '@/hooks/use-membership';
import { Route as MembershipRoute } from '@/routes/account/membership';

import { FundMembershipCard } from './fund-membership-card';
import { NAMESPACE } from './fund.i18n';

// The member's Fund status on the account page, with the way to change or cancel it.
export function FundAccountStatus({ userId }: { userId: string }) {
  return useFundEnabled() ? <MembershipStatus userId={userId} /> : null;
}

function MembershipStatus({ userId }: { userId: string }) {
  const { t } = useTranslation(NAMESPACE);
  const membership = useMembership(userId).data;
  if (membership === undefined || membership.status === 'none') return null;

  return (
    <section aria-label={t('title')} className="flex flex-col gap-3">
      <FundMembershipCard
        membership={membership}
        action={
          <Link
            to={MembershipRoute.to}
            className="border-border hover:bg-muted focus-visible:bg-muted -mx-4 mt-2 -mb-4 flex min-h-11 items-center justify-between gap-2 rounded-b-lg border-t px-4 py-3 text-sm font-medium"
          >
            {t('showDetails')}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        }
      />
      <ManageMembershipButton />
    </section>
  );
}

// Opens the Stripe billing portal, where members change, pay or cancel their membership.
export function ManageMembershipButton() {
  const { t } = useTranslation(NAMESPACE);
  const { state, open } = useOpenStripe();

  return (
    <>
      <Button
        size="lg"
        className={SECONDARY_BUTTON}
        disabled={state === 'opening'}
        onClick={() => void open('/billing-portal-sessions')}
      >
        {t('manage')}
      </Button>
      {state === 'failed' && (
        <p role="alert" className="text-destructive text-sm">
          {t('stripeFailed')}
        </p>
      )}
    </>
  );
}
