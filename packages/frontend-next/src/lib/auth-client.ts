import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { AUTH_URL, getSessionToken, setSessionToken } from '@/lib/session';

// Only the account routes import this, so the client stays in their lazily loaded chunk.
export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [emailOTPClient()],
  fetchOptions: {
    // The client defaults to sending cookies; sessions are bearer tokens, and the auth worker
    // rejects credentialed requests.
    credentials: 'omit',
    auth: { type: 'Bearer', token: getSessionToken },
    // Better Auth's bearer plugin hands out the session token on every response that issues one.
    onSuccess: async ({ response }) => {
      const token = response.headers.get('set-auth-token');
      if (token) await setSessionToken(token);
    },
  },
});
