import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

export type AuthSession = typeof authClient.$Infer.Session;

export type AuthSessionState = (
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: AuthSession }
) & { refetch: () => void };

export function useAuthSession(): AuthSessionState {
  const session = authClient.useSession();
  const failed = !session.data && session.error !== null && session.error.status !== 401;
  // Background refetches must not unmount a signed-out user's partially completed form.
  const [loaded, setLoaded] = useState(false);
  if (!loaded && !session.isPending && !failed) setLoaded(true);

  const refetch = () => void session.refetch();
  if (session.data) return { status: 'signed-in', session: session.data, refetch };
  if (loaded) return { status: 'signed-out', refetch };
  if (session.isPending) return { status: 'loading', refetch };
  if (failed) return { status: 'error', refetch };
  return { status: 'loading', refetch };
}
