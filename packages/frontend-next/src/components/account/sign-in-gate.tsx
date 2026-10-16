import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { type AuthSession, useAuthSession } from '@/hooks/use-auth-session';

import { NAMESPACE } from './account.i18n';
import { SessionLoadError } from './session-load-error';
import { SignInForm } from './sign-in-form';

type SignInGateProps = {
  children: (session: AuthSession, refetch: () => void) => ReactNode;
  signedOut?: (onSignedIn: () => void) => ReactNode;
  loading?: ReactNode;
};

export function SignInGate({ children, signedOut, loading }: SignInGateProps) {
  const { t } = useTranslation(NAMESPACE);
  const state = useAuthSession();

  switch (state.status) {
    case 'signed-in':
      return children(state.session, state.refetch);
    case 'signed-out':
      return signedOut ? signedOut(state.refetch) : <SignInForm onSignedIn={state.refetch} />;
    case 'error':
      return <SessionLoadError onRetry={state.refetch} />;
    case 'loading':
      return loading !== undefined ? (
        loading
      ) : (
        <LoaderCircle
          role="status"
          aria-label={t('loading')}
          className="text-muted-foreground mx-auto size-6 animate-spin"
        />
      );
  }
}
