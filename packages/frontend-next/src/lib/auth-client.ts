import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import {
  AUTH_URL,
  clearSessionToken,
  getSessionAccountId,
  getSessionToken,
  setSessionAccountId,
  setSessionToken,
} from '@/lib/session';
import { captureIssue } from '@/lib/error-monitoring';
import { getTurnstileToken } from '@/lib/turnstile';

// Loaded lazily by account routes and the startup session refresh, so it stays out of the main
// bundle.
export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [emailOTPClient()],
  fetchOptions: {
    // Sessions are bearer tokens; the auth-worker rejects credentialed requests.
    credentials: 'omit',
    auth: { type: 'Bearer', token: getSessionToken },
    onSuccess: async ({ response, request, data }) => {
      const token = response.headers.get('set-auth-token');
      if (token) await setSessionToken(token);
      if (data === null) {
        await clearRejectedSession(request);
        return;
      }
      // Sign-in and get-session responses carry the account the token belongs to. A sign-in sets
      // a new token; any other response must still belong to the current one.
      const accountId = (data as { user?: { id?: unknown } }).user?.id;
      if (typeof accountId !== 'string' || accountId === getSessionAccountId()) return;
      if (token || (await sentCurrentToken(request))) {
        setSessionAccountId(accountId);
      }
    },
    onError: async ({ response, request }) => {
      if (response.status === 401) await clearRejectedSession(request);
    },
  },
});

type AuthRequest = { url: URL | string; headers: Headers };

async function sentCurrentToken(request: AuthRequest): Promise<boolean> {
  const token = await getSessionToken();
  return token !== undefined && request.headers.get('authorization') === `Bearer ${token}`;
}

async function clearRejectedSession(request: AuthRequest) {
  if (!new URL(request.url).pathname.endsWith('/get-session')) return;
  // A response for an old token must not sign out an account that has since signed in.
  if (await sentCurrentToken(request)) await clearSessionToken();
}

// The auth-worker requires a Turnstile token to send a code (skipped where no site key is set).
export async function sendSignInCode(email: string) {
  let captcha: string | undefined;
  try {
    captcha = await getTurnstileToken('sign-in');
  } catch (error) {
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
