import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';

import { INPUT } from './account-layout';
import { NAMESPACE } from './account.i18n';

// Mirrors the auth-worker's rules, which have the final say.
const USERNAME_MIN_LENGTH = 2;
const USERNAME_MAX_LENGTH = 32;

type UsernameFormProps = {
  initial: string;
  submitLabel: string;
  submitClassName: string;
  onSaved?: () => void;
};

export function UsernameForm({
  initial,
  submitLabel,
  submitClassName,
  onSaved,
}: UsernameFormProps) {
  const { t } = useTranslation(NAMESPACE);
  const inputId = useId();
  const errorId = useId();
  const [name, setName] = useState(initial);
  const [state, setState] = useState<'idle' | 'pending' | 'saved' | 'invalid' | 'error'>('idle');
  const unchanged = name.trim() === initial;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setState('pending');
    const { error } = await authClient.updateUser({ name: name.trim() });
    if (error) {
      setState(error.code === 'INVALID_USERNAME' ? 'invalid' : 'error');
      return;
    }
    setState('saved');
    onSaved?.();
  };

  return (
    <form onSubmit={(event) => void save(event)} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {t('usernameLabel')}
      </label>
      <Input
        id={inputId}
        className={INPUT}
        required
        minLength={USERNAME_MIN_LENGTH}
        maxLength={USERNAME_MAX_LENGTH}
        autoComplete="nickname"
        aria-invalid={state === 'invalid'}
        aria-describedby={state === 'invalid' || state === 'error' ? errorId : undefined}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setState('idle');
        }}
      />
      {state === 'invalid' && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {t('usernameInvalid', { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })}
        </p>
      )}
      {state === 'error' && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {t('genericError')}
        </p>
      )}
      {state === 'saved' && (
        <p role="status" className="text-muted-foreground text-sm">
          {t('usernameSaved')}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        disabled={state === 'pending' || unchanged}
        className={submitClassName}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
