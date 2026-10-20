import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ToastPill } from '@/components/ui/toast-pill';
import { useFundEnabled } from '@/hooks/use-fund-enabled';
import { type Membership, membershipQueryOptions, useOpenStripe } from '@/hooks/use-membership';
import { authClient, sendSignInCode } from '@/lib/auth-client';
import { clearSessionToken } from '@/lib/session';
import { toast } from '@/lib/toast';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { BUTTON_SHAPE, DevEmailHint, SECONDARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { type AuthError, AuthErrorMessage, CodeField } from './code-field';

// Stripe would keep charging a deleted account, which could then no longer sign in to cancel.
const blocksDeletion = (membership: Membership) =>
  (membership.status === 'active' || membership.status === 'past_due') &&
  !membership.cancelAtPeriodEnd;

// The auth-worker only deletes within minutes of a sign-in, so this signs in again with a new code.
export function DeleteAccount({ userId, email }: { userId: string; email: string }) {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const fundEnabled = useFundEnabled();
  // Only a hint for the person; the auth-worker enforces the rule with FUND_MEMBERSHIP_ACTIVE.
  const [refusedAt, setRefusedAt] = useState<number | null>(null);
  const membership = useQuery({
    ...membershipQueryOptions(userId),
    enabled: fundEnabled || refusedAt !== null,
  });
  const [step, setStep] = useState<'closed' | 'start' | 'code' | 'signed-in'>('closed');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthError>(null);
  /*
   * When the auth-worker refused because of a membership this page didn't know about (it changed
   * since, or isn't shown as running), the refusal holds until the membership has been read again.
   */
  const refused = refusedAt !== null && membership.dataUpdatedAt <= refusedAt;
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
      else if (error.code === 'FUND_MEMBERSHIP_ACTIVE') setRefusedAt(Date.now());
      else setError(error);
      return;
    }
    await clearSessionToken();
    // Toasts only render on the map.
    await navigate({ to: MapIndexRoute.to });
    toast.custom(() => <ToastPill className="text-sm">{t('deleteDone')}</ToastPill>);
  };

  // What stands in for the current step while the membership is unknown or can still charge.
  const membershipGate = () => {
    if (refused || (membership.data !== undefined && blocksDeletion(membership.data))) {
      return <MembershipBlocksDeletion onClose={() => restart()} />;
    }
    if (membership.isError) {
      return (
        <>
          <p role="alert" className="text-destructive text-sm">
            {t('membershipCheckFailed')}
          </p>
          <Button
            size="lg"
            className={SECONDARY_BUTTON}
            disabled={membership.isFetching}
            onClick={() => void membership.refetch()}
          >
            {t('retry')}
          </Button>
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

  const gate = fundEnabled || refused ? membershipGate() : null;

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

/*
 * Stripe's portal sends web visitors back to /fund. The native app stays where it was, and the
 * membership refetches on focus, so the flow continues here once cancellation is scheduled.
 */
function MembershipBlocksDeletion({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(NAMESPACE);
  const { state, open } = useOpenStripe();

  return (
    <>
      <p className="text-muted-foreground text-sm">{t('deleteBlockedIntro')}</p>
      <Button
        size="lg"
        className={SECONDARY_BUTTON}
        disabled={state === 'opening'}
        onClick={() => void open('/billing-portal-sessions')}
      >
        {t('deleteBlockedAction')}
      </Button>
      {state === 'failed' && (
        <p role="alert" className="text-destructive text-sm">
          {t('stripeFailed')}
        </p>
      )}
      <Button type="button" variant="ghost" onClick={onClose}>
        {t('cancel')}
      </Button>
    </>
  );
}
