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

/*
 * The auth-worker only deletes for a sign-in from the last few minutes, so deleting starts with a
 * fresh code to the account's inbox. Signing in with it right before deleting proves both the inbox
 * and the device, whatever the age of the session this page started with.
 */
export function DeleteAccount({ email }: { email: string }) {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const [step, setStep] = useState<'start' | 'confirm'>('start');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthError>(null);
  // The code is spent once it signs in, so a deletion that fails afterwards is retried without it.
  const [signedIn, setSignedIn] = useState(false);

  const requestCode = async () => {
    setPending(true);
    const { error } = await sendSignInCode(email);
    setPending(false);
    setError(error);
    if (!error) setStep('confirm');
  };

  const deleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    if (!signedIn) {
      const { error } = await authClient.signIn.emailOtp({ email, otp: code });
      if (error) {
        setPending(false);
        setError(error);
        return;
      }
      setSignedIn(true);
    }
    const { error } = await authClient.deleteUser();
    if (error) {
      setPending(false);
      setError(error);
      // Too long since that sign-in to delete with it: start over with a new code.
      if (error.code === 'SESSION_EXPIRED') {
        setSignedIn(false);
        setCode('');
        setStep('start');
      }
      return;
    }
    await clearSessionToken();
    // Toasts only render on the map, so it goes up once the map is showing.
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
          {!signedIn && <CodeField value={code} onChange={setCode} />}
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
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setStep('start');
              setCode('');
              setError(null);
              setSignedIn(false);
            }}
          >
            {t('cancel')}
          </Button>
        </form>
      )}
    </section>
  );
}
