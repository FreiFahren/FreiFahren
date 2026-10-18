import { useEffect } from 'react';

import { useAuthSession } from '@/hooks/use-auth-session';
import { authClient } from '@/lib/auth-client';
import { clearSessionToken, getSessionToken, useSessionToken } from '@/lib/session';
import { FeatureFlagAccount } from './feature-flag-account';

// Observe Better Auth globally without delaying the router or requiring an account screen.
export default function AuthSession() {
  const state = useAuthSession();
  const token = useSessionToken();
  const session =
    state.status === 'signed-in' && state.session.session.token === token ? state.session : null;

  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = new Date(session.session.expiresAt).getTime() - Date.now();
      if (remaining > 0) {
        timer = setTimeout(checkExpiry, Math.min(remaining, 2 ** 31 - 1));
      } else {
        void getSessionToken().then(async (currentToken) => {
          if (currentToken !== session.session.token) return;
          await clearSessionToken();
          authClient.$store.notify('$sessionSignal');
        });
      }
    };
    checkExpiry();
    return () => clearTimeout(timer);
  }, [session]);

  return <FeatureFlagAccount userId={session?.user.id ?? null} />;
}
