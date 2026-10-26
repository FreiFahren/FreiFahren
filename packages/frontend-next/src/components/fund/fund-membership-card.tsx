import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { type Membership, useEuro } from '@/hooks/use-membership';

import { FundStatusCard } from './fund-status-card';
import { NAMESPACE } from './fund.i18n';

export function FundMembershipCard({
  membership,
  action,
}: {
  membership: Membership;
  action?: ReactNode;
}) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const euro = useEuro();
  const { status } = membership;
  if (status === 'none') return null;

  let date: string | null = null;
  if (membership.currentPeriodEnd !== null) {
    date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
      new Date(membership.currentPeriodEnd),
    );
  }
  const ending = status === 'active' && membership.cancelAtPeriodEnd && date !== null;
  const sharedProps = {
    action,
    details: (
      <>
        {membership.legalName !== null && <p>{t('legalName', { name: membership.legalName })}</p>}
        {membership.amountCents !== null && status !== 'canceled' && (
          <p>{t('contribution', { amount: euro(membership.amountCents) })}</p>
        )}
        {date !== null && status === 'active' && !ending && <p>{t('renewsOn', { date })}</p>}
      </>
    ),
  };

  if (status === 'past_due') {
    return (
      <FundStatusCard
        {...sharedProps}
        tone="danger"
        title={t('statusPastDue')}
        body={t('memberPastDueBody')}
      />
    );
  }

  if (status === 'pending') {
    return (
      <FundStatusCard
        {...sharedProps}
        tone="warn"
        title={t('pendingTitle')}
        body={t('pendingBody')}
      />
    );
  }

  if (status === 'canceled') {
    return (
      <FundStatusCard
        {...sharedProps}
        tone="danger"
        title={t('canceledTitle')}
        body={t('canceledBody')}
      />
    );
  }

  if (ending) {
    return (
      <FundStatusCard
        {...sharedProps}
        tone="warn"
        title={t('statusEnding', { date })}
        body={t('statusEndingBody')}
      />
    );
  }

  return <FundStatusCard {...sharedProps} tone="ok" title={t('statusProtected')} />;
}
