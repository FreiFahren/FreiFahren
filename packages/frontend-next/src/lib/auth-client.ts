import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { AUTH_URL, getSessionToken, setSessionToken } from '@/lib/session';
import { captureIssue } from '@/lib/error-monitoring';
import { getTurnstileToken } from '@/lib/turnstile';

// Only the account routes import this, so it stays out of the main bundle.
export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [emailOTPClient()],
  fetchOptions: {
    // Sessions are bearer tokens; the auth-worker rejects credentialed requests.
    credentials: 'omit',
    auth: { type: 'Bearer', token: getSessionToken },
    onSuccess: async ({ response }) => {
      const token = response.headers.get('set-auth-token');
      if (token) await setSessionToken(token);
    },
  },
});

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
