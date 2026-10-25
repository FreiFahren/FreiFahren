import { Link, useNavigate } from '@tanstack/react-router';
import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ManageMembershipButton } from '@/components/fund/fund-account-status';
import { FundContributions } from '@/components/fund/fund-contributions';
import { FundMembershipCard } from '@/components/fund/fund-membership-card';
import { NAMESPACE } from '@/components/fund/fund.i18n';
import { Button } from '@/components/ui/button';
import { useFundEnabled } from '@/hooks/use-fund-enabled';
import { useMembership } from '@/hooks/use-membership';
import { Route as AccountRoute } from '@/routes/account/index';
import { Route as FundRoute } from '@/routes/fund/index';

import { AccountLayout, SECONDARY_BUTTON } from './account-layout';
import { SignInGate } from './sign-in-gate';

export function MembershipPage() {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const enabled = useFundEnabled();

  return (
    <AccountLayout
      title={t('membershipTitle')}
      onBack={() => void navigate({ to: AccountRoute.to })}
    >
      {enabled && (
        <SignInGate>
          {({ user, session }) => (
            <>
              <MembershipDetails userId={user.id} />
              <FundContributions userId={user.id} sessionId={session.id} />
            </>
          )}
        </SignInGate>
      )}
    </AccountLayout>
  );
}

function MembershipDetails({ userId }: { userId: string }) {
  const { t } = useTranslation(NAMESPACE);
  const membership = useMembership(userId);

  if (membership.isPending) {
    return (
      <LoaderCircle
        role="status"
        aria-label={t('loadingMembership')}
        className="mx-auto size-6 animate-spin"
      />
    );
  }

  if (membership.isError) {
    return (
      <div role="alert" className="flex flex-col gap-3 text-sm">
        <p>{t('loadFailed')}</p>
        <Button className={SECONDARY_BUTTON} onClick={() => void membership.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  return (
    <section aria-label={t('title')} className="flex flex-col gap-3">
      <FundMembershipCard membership={membership.data} />
      {membership.data.status !== 'none' && <ManageMembershipButton />}
      {(membership.data.status === 'none' || membership.data.status === 'canceled') && (
        <Button asChild className={SECONDARY_BUTTON}>
          <Link to={FundRoute.to}>{t('joinFund')}</Link>
        </Button>
      )}
    </section>
  );
}
