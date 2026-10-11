import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { AUTH_URL, getSessionToken, setSessionToken } from '@/lib/session';
import { captureIssue } from '@/lib/error-monitoring';
import { getTurnstileToken } from '@/lib/turnstile';

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

/*
 * Every email the auth-worker sends is a sign-in code, and it requires a solved Turnstile challenge
 * for it (where a site key is configured; dev builds and the worker without a secret skip both).
 * Its own action keeps these challenges apart from report submissions in Turnstile.
 */
export async function sendSignInCode(email: string) {
  let captcha: string | undefined;
  try {
    captcha = await getTurnstileToken('sign-in');
  } catch (error) {
    // The auth-worker never sees this failure, so it's recorded here.
    captureIssue('Turnstile token could not be obtained for sign-in', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return { error: { status: 0, code: 'CAPTCHA_FAILED' } };
  }
  return authClient.emailOtp.sendVerificationOtp({
    email,
    type: 'sign-in',
    fetchOptions:
      captcha === undefined ? undefined : { headers: { 'x-captcha-response': captcha } },
  });
}
