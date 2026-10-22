import { expect, test } from '@playwright/test';

test('PIN color follows length while validation and loading safeguards remain intact', async ({
  page,
}) => {
  let submissions = 0;
  let releaseVerification!: () => void;
  const verification = new Promise<void>((resolve) => {
    releaseVerification = resolve;
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:1873') return route.abort();
    if (url.pathname.endsWith('/get-session')) return route.fulfill({ json: null });
    if (url.pathname.endsWith('/send-verification-otp')) {
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname.endsWith('/sign-in/email-otp')) {
      submissions++;
      expect(route.request().postDataJSON()).toMatchObject({
        email: 'pin-test@example.invalid',
        otp: '123456',
      });
      await verification;
      return route.fulfill({ status: 400, json: { code: 'INVALID_OTP' } });
    }
    return route.continue();
  });
  await page.addInitScript(() => {
    localStorage.setItem('i18nextLng', 'en');
    localStorage.setItem('legalDisclaimerAcceptedAt', new Date().toISOString());
  });
  await page.goto('/account');
  await page.getByRole('textbox', { name: 'Email address' }).fill('pin-test@example.invalid');
  await page.getByRole('button', { name: 'Send code', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Sign-in code', exact: true });
  const submit = page.getByRole('button', { name: 'Sign in', exact: true });
  // Compare rendered colors to the app's theme.
  const color = async (token: string) => {
    const expected = await page.evaluate((name) => {
      const probe = document.createElement('span');
      probe.style.backgroundColor = `var(${name})`;
      document.body.append(probe);
      const result = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return result;
    }, token);
    await expect(submit).toHaveCSS('background-color', expected);
  };
  await expect(input).toBeVisible();
  await page.mouse.move(0, 0);
  await color('--muted');
  await submit.click();
  expect(submissions).toBe(0);
  for (const value of ['1', '12', '123', '1234', '12345']) {
    await input.fill(value);
    await page.mouse.move(0, 0);
    await color('--muted');
  }
  await input.press('Enter');
  expect(submissions).toBe(0);
  await input.pressSequentially('6');
  await color('--accent-bright');
  await input.press('ControlOrMeta+ArrowRight');
  await input.press('Backspace');
  await expect(input).toHaveValue('12345');
  await color('--muted');
  await input.fill('');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(() => navigator.clipboard.writeText('1234567'));
  await input.press('ControlOrMeta+V');
  await expect(input).toHaveValue('123456');
  await color('--accent-bright');
  await input.fill('12a34');
  await expect(input).toHaveValue('1234');
  await color('--muted');
  await input.fill('123456');
  await submit.click();
  await expect.poll(() => submissions).toBe(1);
  await expect(submit).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Send a new code' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Use a different email' })).toBeDisabled();
  await page.mouse.move(0, 0);
  await color('--accent-bright');
  releaseVerification();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(submit).toBeEnabled();
  await color('--accent-bright');
  await input.press('ControlOrMeta+ArrowRight');
  await input.press('Backspace');
  await expect(input).toHaveValue('12345');
  await color('--muted');
  await page.getByRole('button', { name: 'Send a new code' }).click();
  await expect(input).toHaveValue('');
  await page.mouse.move(0, 0);
  await color('--muted');
  expect(submissions).toBe(1);
});
