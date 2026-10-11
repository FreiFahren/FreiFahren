import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

import { DevEmailHint, INPUT, PRIMARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';

type AuthError = { status: number; code?: string } | null;

function errorKey(error: NonNullable<AuthError>) {
  if (error.status === 429 || error.code === 'TOO_MANY_ATTEMPTS') return 'tooManyRequests';
  if (error.code === 'INVALID_OTP') return 'invalidCode';
  if (error.code === 'OTP_EXPIRED') return 'expiredCode';
  return 'genericError';
}

export function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useTranslation(NAMESPACE);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthError>(null);
  const [resent, setResent] = useState(false);

  const requestCode = async () => {
    setPending(true);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: 'sign-in',
    });
    setPending(false);
    setError(error);
    return !error;
  };

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await requestCode()) setStep('code');
  };

  const resendCode = async () => {
    setCode('');
    setResent(await requestCode());
  };

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setResent(false);
    setPending(true);
    const { error } = await authClient.signIn.emailOtp({ email: email.trim(), otp: code });
    setPending(false);
    setError(error);
    if (!error) onSignedIn();
  };

  const errorMessage = error && (
    <p role="alert" className="text-destructive text-sm">
      {t(errorKey(error))}
    </p>
  );

  if (step === 'email') {
    return (
      <form onSubmit={(event) => void sendCode(event)} className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">{t('emailIntro')}</p>
        <Input
          className={INPUT}
          type="email"
          required
          autoComplete="email"
          aria-label={t('emailLabel')}
          placeholder={t('emailLabel')}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {errorMessage}
        <Button type="submit" size="lg" disabled={pending} className={PRIMARY_BUTTON}>
          {t('sendCode')}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={(event) => void signIn(event)} className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">{t('codeIntro', { email: email.trim() })}</p>
      <DevEmailHint />
      <Input
        className={`${INPUT} tracking-widest`}
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        aria-label={t('codeLabel')}
        placeholder={t('codeLabel')}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
      />
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
