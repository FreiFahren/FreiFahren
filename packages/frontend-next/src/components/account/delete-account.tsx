import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ToastPill } from '@/components/ui/toast-pill';
import { authClient, sendSignInCode } from '@/lib/auth-client';
import { clearSessionToken } from '@/lib/session';
import { toast } from '@/lib/toast';
import { useAuthSession } from '@/hooks/use-auth-session';
import { useMembershipGate } from '@/hooks/use-membership-gate';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { BUTTON_SHAPE, DevEmailHint } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { type AuthError, AuthErrorMessage, CodeField } from './code-field';
import { AccountDeletionGate } from './account-deletion-gate';

// Only shown to a signed-in account, which it reads itself rather than from its parents.
export function DeleteAccount() {
  const auth = useAuthSession();
  if (auth.status !== 'signed-in') return null;
  const { id, email } = auth.session.user;
  return <DeletionFlow userId={id} email={email} />;
}

// The auth-worker only deletes within minutes of a sign-in, so this signs in again with a new code.
function DeletionFlow({ userId, email }: { userId: string; email: string }) {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const { gate, refuse } = useMembershipGate(userId);
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
      else if (error.code === 'FUND_MEMBERSHIP_ACTIVE') refuse(error);
      else setError(error);
      return;
    }
    await clearSessionToken();
    // Toasts only render on the map.
    await navigate({ to: MapIndexRoute.to });
    toast.custom(() => <ToastPill className="text-sm">{t('deleteDone')}</ToastPill>);
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

  const cancel = (
    <Button type="button" variant="ghost" disabled={pending} onClick={() => restart()}>
      {t('cancel')}
    </Button>
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t('deleteTitle')}</h2>
      <AccountDeletionGate gate={gate} onClose={() => restart()}>
        {step === 'start' ? (
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
            {cancel}
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
            {cancel}
          </form>
        )}
      </AccountDeletionGate>
    </section>
  );
}
