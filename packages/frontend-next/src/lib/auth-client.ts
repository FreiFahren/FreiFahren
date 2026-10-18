import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { AUTH_URL, clearSessionToken, getSessionToken, setSessionToken } from '@/lib/session';
import { captureIssue } from '@/lib/error-monitoring';
import { getTurnstileToken } from '@/lib/turnstile';

// Account routes and the global startup observer share Better Auth’s session store.
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
      if (data === null) await clearRejectedSession(request);
    },
    onError: async ({ response, request }) => {
      if (response.status === 401) await clearRejectedSession(request);
    },
  },
});

async function clearRejectedSession(request: { url: URL | string; headers: Headers }) {
  if (!new URL(request.url).pathname.endsWith('/get-session')) return;
  const token = await getSessionToken();
  // A response for an old token must not sign out an account that has since signed in.
  if (token && request.headers.get('authorization') === `Bearer ${token}`) {
    await clearSessionToken();
  }
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
