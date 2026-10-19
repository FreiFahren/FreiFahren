import { useTranslation } from 'react-i18next';

import { SECONDARY_BUTTON } from '@/components/account/account-layout';
import { Button } from '@/components/ui/button';
import { useFundEnabled } from '@/hooks/use-fund-enabled';
import { useEuro, useMembership, useOpenStripe } from '@/hooks/use-membership';

import { FundStatusCard } from './fund-status-card';
import { NAMESPACE } from './fund.i18n';

// The member's Fund status on the account page, with the way to change or cancel it.
export function FundAccountStatus({ userId }: { userId: string }) {
  return useFundEnabled() ? <MembershipStatus userId={userId} /> : null;
}

function MembershipStatus({ userId }: { userId: string }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const euro = useEuro();
  const { state, open } = useOpenStripe();
  const membership = useMembership(userId).data;
  if (membership?.status !== 'active' && membership?.status !== 'past_due') return null;

  const pastDue = membership.status === 'past_due';
  const date =
    membership.currentPeriodEnd === null
      ? null
      : new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
          new Date(membership.currentPeriodEnd),
        );
  // Canceled in the portal but paid up: still covered, just not for long.
  const ending = !pastDue && membership.cancelAtPeriodEnd && date !== null;

  return (
    <section aria-label={t('title')} className="flex flex-col gap-3">
      <FundStatusCard
        tone={pastDue ? 'danger' : ending ? 'warn' : 'ok'}
        title={
          pastDue ? t('statusPastDue') : ending ? t('statusEnding', { date }) : t('statusProtected')
        }
        body={pastDue ? t('memberPastDueBody') : ending ? t('statusEndingBody') : undefined}
        details={
          <>
            {membership.amountCents !== null && (
              <p>{t('contribution', { amount: euro(membership.amountCents) })}</p>
            )}
            {date !== null && !ending && <p>{t('renewsOn', { date })}</p>}
          </>
        }
      />
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
    </section>
  );
}
