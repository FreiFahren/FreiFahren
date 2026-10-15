import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { type AuthSession, useAuthSession } from '@/hooks/use-auth-session';

import { NAMESPACE } from './account.i18n';
import { SessionLoadError } from './session-load-error';
import { SignInForm } from './sign-in-form';

type SignInGateProps = {
  children: (session: AuthSession, refetch: () => void) => ReactNode;
  signedOut?: (signIn: ReactNode) => ReactNode;
};

export function SignInGate({ children, signedOut }: SignInGateProps) {
  const { t } = useTranslation(NAMESPACE);
  const state = useAuthSession();
  if (state.status === 'signed-in') return children(state.session, state.refetch);

  let content: ReactNode;
  switch (state.status) {
    case 'signed-out':
      content = <SignInForm onSignedIn={state.refetch} />;
      break;
    case 'error':
      content = <SessionLoadError onRetry={state.retry} />;
      break;
    case 'loading':
      content = (
        <LoaderCircle
          role="status"
          aria-label={t('loading')}
          className="text-muted-foreground mx-auto size-6 animate-spin"
        />
      );
      break;
  }
  return signedOut ? signedOut(content) : content;
}
