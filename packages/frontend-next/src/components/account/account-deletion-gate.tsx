import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { ManageMembershipButton } from '@/components/fund/fund-account-status';
import { Button } from '@/components/ui/button';
import type { AccountDeletionBlocker } from '@/hooks/use-membership';
import type { MembershipGate } from '@/hooks/use-membership-gate';

import { SupportEmailLink } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { SessionLoadError } from './session-load-error';

type AccountDeletionGateProps = {
  gate: MembershipGate;
  onClose: () => void;
  // The current deletion step, shown once nothing about the membership blocks deletion.
  children: ReactNode;
};

// Like SignInGate: the deletion steps only render once the membership lets the account go.
export function AccountDeletionGate({ gate, onClose, children }: AccountDeletionGateProps) {
  const { t } = useTranslation(NAMESPACE);

  if (gate === null) return children;
  if (gate.kind === 'checking') {
    return (
      <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        {t('membershipChecking')}
      </p>
    );
  }

  return (
    <>
      {gate.kind === 'blocked' ? (
        <BlockedBy blocker={gate.blockedBy} />
      ) : (
        <SessionLoadError
          message={t('membershipCheckFailed')}
          retrying={gate.retrying}
          onRetry={gate.retry}
        />
      )}
      <Button type="button" variant="ghost" onClick={() => onClose()}>
        {t('cancel')}
      </Button>
    </>
  );
}

const BLOCKED_COPY = {
  membership: { intro: 'deleteBlockedIntro', action: 'deleteBlockedAction', support: null },
  overdue_payment: {
    intro: 'deleteBlockedOverdueIntro',
    action: 'deleteBlockedOverdueAction',
    support: 'deleteBlockedOverdueSupport',
  },
  // Stripe's portal can't cancel a signup whose first payment never went through.
  unfinished_signup: { intro: 'deleteBlockedSignupIntro', action: null, support: null },
} as const satisfies Record<AccountDeletionBlocker, unknown>;

// The membership refetches on focus, so the flow continues once nothing blocks deletion.
function BlockedBy({ blocker }: { blocker: AccountDeletionBlocker }) {
  const { t } = useTranslation(NAMESPACE);
  const copy = BLOCKED_COPY[blocker];

  return (
    <>
      <p className="text-muted-foreground text-sm">{t(copy.intro)}</p>
      {copy.support !== null && (
        <p className="text-muted-foreground text-sm">
          {t(copy.support)} <SupportEmailLink />
        </p>
      )}
      {copy.action !== null && <ManageMembershipButton label={t(copy.action)} returnTo="account" />}
    </>
  );
}
