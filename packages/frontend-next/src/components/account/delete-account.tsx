import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ToastPill } from '@/components/ui/toast-pill';
import { ManageMembershipButton } from '@/components/fund/fund-account-status';
import { useFundEnabled } from '@/hooks/use-fund-enabled';
import { type Membership, membershipQueryOptions } from '@/hooks/use-membership';
import { authClient, sendSignInCode } from '@/lib/auth-client';
import { clearSessionToken } from '@/lib/session';
import { toast } from '@/lib/toast';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { BUTTON_SHAPE, DevEmailHint, SupportEmailLink } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { type AuthError, AuthErrorMessage, CodeField } from './code-field';
import { SessionLoadError } from './session-load-error';

type Blocker = NonNullable<Membership['accountDeletionBlockedBy']>;

// The auth-worker only deletes within minutes of a sign-in, so this signs in again with a new code.
export function DeleteAccount({ userId, email }: { userId: string; email: string }) {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  /*
   * The auth-worker's refusal says what blocks deletion. It stands until the membership has been
   * read again, e.g. on returning from Stripe.
   */
  const [refusal, setRefusal] = useState<{ blockedBy: Blocker; at: number } | null>(null);
  const gated = useFundEnabled() || refusal !== null;
  // Only a hint for the person; the auth-worker enforces the rule with FUND_MEMBERSHIP_ACTIVE.
  const membership = useQuery({ ...membershipQueryOptions(userId), enabled: gated });
  const [step, setStep] = useState<'closed' | 'start' | 'code' | 'signed-in'>('closed');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthError>(null);
  // Leaving the page while the code is checked must not delete afterwards.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // With a reason, back to requesting a code; without, closed again.
  const restart = (reason: AuthError = null) => {
    setStep(reason ? 'start' : 'closed');
    setCode('');
    setError(reason);
  };

  const requestCode = async () => {
    setPending(true);
    const { error } = await sendSignInCode(email);
    setPending(false);
    setError(error);
    if (!error) setStep('code');
  };

  const deleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    if (step === 'code') {
      // deleteUser refreshes the session anyway.
      const { error } = await authClient.signIn.emailOtp({
        email,
        otp: code,
        fetchOptions: { disableSignal: true },
      });
      if (error) {
        setPending(false);
        setError(error);
        return;
      }
      setStep('signed-in');
    }
    if (!mounted.current) return;
    const { error } = await authClient.deleteUser();
    if (error) {
      setPending(false);
      if (error.code === 'SESSION_EXPIRED') restart(error);
      else if (error.code === 'FUND_MEMBERSHIP_ACTIVE') {
        const blockedBy = 'blockedBy' in error ? error.blockedBy : undefined;
        setRefusal({
          blockedBy:
            typeof blockedBy === 'string' && blockedBy in BLOCKED_COPY
              ? (blockedBy as Blocker)
              : 'membership',
          at: Date.now(),
        });
        // A read already in flight predates the refusal and must not lift it; refetching cancels it.
        void membership.refetch();
      } else setError(error);
      return;
    }
    await clearSessionToken();
    // Toasts only render on the map.
    await navigate({ to: MapIndexRoute.to });
    toast.custom(() => <ToastPill className="text-sm">{t('deleteDone')}</ToastPill>);
  };

  // What stands in for the current step while the membership is unknown or can still charge.
  const membershipGate = () => {
    const blockedBy =
      refusal !== null && membership.dataUpdatedAt <= refusal.at
        ? refusal.blockedBy
        : membership.data?.accountDeletionBlockedBy;
    if (blockedBy)
      return <MembershipBlocksDeletion blockedBy={blockedBy} onClose={() => restart()} />;
    // A failed refetch keeps the last answer, so a network blip doesn't interrupt the flow.
    if (membership.data === undefined && membership.isError) {
      return (
        <>
          <SessionLoadError
            message={t('membershipCheckFailed')}
            retrying={membership.isFetching}
            onRetry={() => void membership.refetch()}
          />
          <Button type="button" variant="ghost" onClick={() => restart()}>
            {t('cancel')}
          </Button>
        </>
      );
    }
    if (membership.isPending) {
      return (
        <p role="status" className="text-muted-foreground flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {t('membershipChecking')}
        </p>
      );
    }
    return null;
  };

  if (step === 'closed') {
    return (
      <button
        type="button"
        onClick={() => setStep('start')}
        className="text-muted-foreground hover:text-destructive self-center text-sm underline-offset-4 hover:underline"
      >
        {t('deleteTitle')}
      </button>
    );
  }

  const gate = gated ? membershipGate() : null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t('deleteTitle')}</h2>
      {gate ??
        (step === 'start' ? (
          <>
            <p className="text-muted-foreground text-sm">{t('deleteIntro')}</p>
            <AuthErrorMessage error={error} />
            <Button
              variant="destructive"
              size="lg"
              disabled={pending}
              onClick={() => void requestCode()}
              className={BUTTON_SHAPE}
            >
              {t('deleteRequest')}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => restart()}>
              {t('cancel')}
            </Button>
          </>
        ) : (
          <form onSubmit={(event) => void deleteAccount(event)} className="flex flex-col gap-3">
            <p className="text-sm">{t('deleteConfirmIntro', { email })}</p>
            <DevEmailHint />
            {step === 'code' && <CodeField value={code} onChange={setCode} />}
            <AuthErrorMessage error={error} />
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              disabled={pending}
              className={BUTTON_SHAPE}
            >
              {t('deleteConfirm')}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => restart()}>
              {t('cancel')}
            </Button>
          </form>
        ))}
    </section>
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
} as const satisfies Record<Blocker, unknown>;

// The membership refetches on focus, so the flow continues here once nothing blocks deletion.
function MembershipBlocksDeletion({
  blockedBy,
  onClose,
}: {
  blockedBy: Blocker;
  onClose: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  const copy = BLOCKED_COPY[blockedBy];

  return (
    <>
      <p className="text-muted-foreground text-sm">{t(copy.intro)}</p>
      {copy.support !== null && (
        <p className="text-muted-foreground text-sm">
          {t(copy.support)} <SupportEmailLink />
        </p>
      )}
      {copy.action !== null && <ManageMembershipButton label={t(copy.action)} returnTo="account" />}
      <Button type="button" variant="ghost" onClick={onClose}>
        {t('cancel')}
      </Button>
    </>
  );
}
