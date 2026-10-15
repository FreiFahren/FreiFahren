import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics';
import { authClient, sendSignInCode } from '@/lib/auth-client';
import { preloadTurnstile } from '@/lib/turnstile';
import { Route as PrivacyRoute } from '@/routes/privacy';

import { DevEmailHint, INPUT, PRIMARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { type AuthError, AuthErrorMessage, CodeField } from './code-field';

export function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useTranslation(NAMESPACE);
  const [email, setEmail] = useState('');
  // The address the code went to, which later edits to the field can't change.
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthError>(null);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    preloadTurnstile();
    track('sign_in_viewed', {});
  }, []);

  const requestCode = async (to: string, resend: boolean) => {
    setPending(true);
    const { error } = await sendSignInCode(to);
    setPending(false);
    setError(error);
    if (!error) track('sign_in_code_requested', { resend });
    return !error;
  };

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const to = email.trim();
    if (!(await requestCode(to, false))) return;
    setSubmittedEmail(to);
    setStep('code');
  };

  const resendCode = async () => {
    setCode('');
    setResent(await requestCode(submittedEmail, true));
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setResent(false);
    setPending(true);
    const { error } = await authClient.signIn.emailOtp({ email: submittedEmail, otp: code });
    setPending(false);
    setError(error);
    if (error) return;
    track('sign_in_completed', {});
    onSignedIn();
  };

  const errorMessage = <AuthErrorMessage error={error} />;

  if (step === 'email') {
    return (
      <form onSubmit={(event) => void sendCode(event)} className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">{t('emailIntro')}</p>
        <Input
          className={INPUT}
          type="email"
          required
          autoComplete="email"
          disabled={pending}
          aria-label={t('emailLabel')}
          placeholder={t('emailLabel')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {errorMessage}
        <Button type="submit" size="lg" disabled={pending} className={PRIMARY_BUTTON}>
          {t('sendCode')}
        </Button>
        <p className="text-muted-foreground text-xs">
          {t('privacyNotice')}{' '}
          <Link to={PrivacyRoute.to} className="text-foreground underline">
            {t('privacyLink')}
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={(event) => void signIn(event)} className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t('codeIntro', { email: submittedEmail })}</p>
      <DevEmailHint />
      <CodeField value={code} onChange={setCode} />
      {errorMessage}
      {resent && !error && (
        <p role="status" className="text-muted-foreground text-sm">
          {t('codeResent')}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className={PRIMARY_BUTTON}>
        {t('signIn')}
      </Button>
      <div className="flex flex-col">
        <Button type="button" variant="ghost" disabled={pending} onClick={() => void resendCode()}>
          {t('resendCode')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setStep('email');
            setCode('');
            setError(null);
            setResent(false);
          }}
        >
          {t('changeEmail')}
        </Button>
      </div>
    </form>
  );
}
