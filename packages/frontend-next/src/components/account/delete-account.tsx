import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ToastPill } from '@/components/ui/toast-pill';
import { authClient, sendSignInCode } from '@/lib/auth-client';
import { clearSessionToken } from '@/lib/session';
import { toast } from '@/lib/toast';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { BUTTON_SHAPE, DevEmailHint } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { type AuthError, AuthErrorMessage, CodeField } from './code-field';

// The auth-worker only deletes within minutes of a sign-in, so this signs in again with a new code.
export function DeleteAccount({ email }: { email: string }) {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const [step, setStep] = useState<'start' | 'code' | 'signed-in'>('start');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthError>(null);

  const restart = (reason: AuthError = null) => {
    setStep('start');
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
    const { error } = await authClient.deleteUser();
    if (error) {
      setPending(false);
      if (error.code === 'SESSION_EXPIRED') restart(error);
      else setError(error);
      return;
    }
    await clearSessionToken();
    // Toasts only render on the map.
    await navigate({ to: MapIndexRoute.to });
    toast.custom(() => <ToastPill className="text-sm">{t('deleteDone')}</ToastPill>);
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t('deleteTitle')}</h2>
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
          <Button type="button" variant="ghost" onClick={() => restart()}>
            {t('cancel')}
          </Button>
        </form>
      )}
    </section>
  );
}
