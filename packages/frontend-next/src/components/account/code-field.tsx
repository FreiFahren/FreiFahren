import { useTranslation } from 'react-i18next';

import { Input } from '@/components/ui/input';

import { INPUT } from './account-layout';
import { NAMESPACE } from './account.i18n';

export type AuthError = { status: number; code?: string } | null;

const MESSAGE_FOR_CODE: Record<string, string> = {
  TOO_MANY_ATTEMPTS: 'tooManyRequests',
  INVALID_OTP: 'invalidCode',
  OTP_EXPIRED: 'expiredCode',
  // Turnstile
  CAPTCHA_FAILED: 'verificationFailed',
  MISSING_RESPONSE: 'verificationFailed',
  VERIFICATION_FAILED: 'verificationFailed',
};

export function AuthErrorMessage({ error }: { error: AuthError }) {
  const { t } = useTranslation(NAMESPACE);
  if (!error) return null;
  const key =
    error.status === 429
      ? 'tooManyRequests'
      : (MESSAGE_FOR_CODE[error.code ?? ''] ?? 'genericError');
  return (
    <p role="alert" className="text-destructive text-sm">
      {t(key)}
    </p>
  );
}

export function CodeField({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <Input
      className={`${INPUT} tracking-widest`}
      required
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      aria-label={t('codeLabel')}
      placeholder={t('codeLabel')}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
    />
  );
}
