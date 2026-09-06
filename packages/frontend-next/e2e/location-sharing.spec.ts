import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, remembered = false, permission = 'prompt', error = 0) {
  await page.addInitScript(
    ({ remembered, permission, error }) => {
      if (remembered) localStorage.setItem('locationPreviouslySucceeded', 'true');
      Object.defineProperty(navigator, 'permissions', {
        value: {
          query: async () => {
            if (permission === 'unsupported') throw new TypeError();
            return { state: permission };
          },
        },
      });
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: (success: PositionCallback, failure: PositionErrorCallback) => {
            if (error) failure({ code: error } as GeolocationPositionError);
            else
              success({
                coords: { latitude: 52.52, longitude: 13.4, accuracy: 10 },
              } as GeolocationPosition);
          },
        },
      });
    },
    { remembered, permission, error },
  );
}

for (const flow of ['map', 'report']) {
  test(`${flow}: first success skips soft ask after reload despite Safari prompt state`, async ({
    page,
  }) => {
    await setup(page);
    await page.goto(`/e2e/fixtures/location.html?${flow}`);
    const allow = page.getByRole('button', { name: 'Use location' });
    await expect(allow).toBeVisible({ timeout: 25000 });
    await expect(page.locator('output')).toHaveText('idle');
    await allow.click();
    await expect(page.locator('output')).toHaveText('tracking');
    await page.reload();
    await expect(page.locator('output')).toHaveText('tracking');
    await expect(allow).toHaveCount(0);
  });
}

for (const permission of ['granted', 'unsupported', 'denied']) {
  test(`returning user with ${permission} permission`, async ({ page }) => {
    await setup(page, true, permission);
    await page.goto('/e2e/fixtures/location.html?report');
    await expect(page.locator('output')).toHaveText(permission === 'denied' ? 'idle' : 'tracking');
    await expect(page.getByRole('button', { name: 'Use location' })).toHaveCount(0);
    if (permission === 'denied') {
      await expect(page.getByText('denied', { exact: true })).toBeVisible();
      expect(
        await page.evaluate(() => localStorage.getItem('locationPreviouslySucceeded')),
      ).toBeNull();
    }
  });
}

for (const error of [1, 3]) {
  test(`request error ${error} ${error === 1 ? 'clears' : 'retains'} previous success`, async ({
    page,
  }) => {
    await setup(page, true, 'prompt', error);
    await page.goto('/e2e/fixtures/location.html?report');
    await expect(page.locator('output')).toHaveText(error === 1 ? 'denied' : 'unavailable');
    await expect(page.getByText('complete', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('locationPreviouslySucceeded'))).toBe(
      error === 1 ? null : 'true',
    );
  });
}
