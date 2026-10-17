import { expect, test, type Page, type Route } from '@playwright/test';

const STATION_ID = 'test-station';
const COOLDOWN_MS = 15 * 60 * 1000;
const reportUrl = `/report?stationId=${STATION_ID}`;
const submitButton = (page: Page) =>
  page.getByRole('button', { name: 'Submit report', exact: true });
const lastReportAt = (page: Page) => page.evaluate(() => localStorage.getItem('lastReportAt'));

async function continueWithoutLocation(page: Page) {
  await page.getByRole('button', { name: 'Continue without', exact: true }).click();
  await expect(submitButton(page)).toBeVisible();
}

async function reopenForm(page: Page) {
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await continueWithoutLocation(page);
}

async function acceptReport(route: Route) {
  await route.fulfill({
    json: {
      reportId: 1,
      stationId: STATION_ID,
      lineId: null,
      directionId: null,
      timestamp: new Date().toISOString(),
    },
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('legalDisclaimerAcceptedAt', new Date().toISOString());
    localStorage.setItem('i18nextLng', 'en');
    // A local fake exercises token acquisition without loading or solving a real challenge.
    window.turnstile = {
      render: (_container, options) => {
        queueMicrotask(() => options.callback('test-token'));
        return 'test-widget';
      },
      remove: () => {},
    };
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === 'http://127.0.0.1:1873') return route.continue();
    if (url.origin !== 'https://report-tests.invalid') return route.abort();
    switch (url.pathname) {
      case '/v0/transit/stations':
        return route.fulfill({
          json: {
            [STATION_ID]: {
              name: 'Test station',
              coordinates: { latitude: 52.5, longitude: 13.4 },
              lines: [],
            },
          },
        });
      case '/v0/transit/segments':
        return route.fulfill({ json: { type: 'FeatureCollection', features: [] } });
      case '/style.json':
        return route.fulfill({ json: { version: 8, sources: {}, layers: [] } });
      default:
        // Individual tests intercept report POSTs; an unexpected write must never leave the test.
        if (route.request().method() !== 'GET') return route.abort();
        return route.fulfill({ json: [] });
    }
  });
  await page.goto(reportUrl);
  await continueWithoutLocation(page);
});

for (const failure of ['network', '403', '503', 'turnstile'] as const) {
  test(`${failure} failure allows an immediate retry without changing the previous timestamp`, async ({
    page,
  }) => {
    const oldTimestamp = String(Date.now() - COOLDOWN_MS - 1000);
    await page.evaluate(
      (timestamp) => localStorage.setItem('lastReportAt', timestamp),
      oldTimestamp,
    );
    if (failure === 'turnstile') {
      await page.evaluate(() => {
        window.turnstile!.render = (_container, options) => {
          queueMicrotask(() => options['error-callback']('test-failure'));
          return 'test-widget';
        };
      });
    }
    let submissions = 0;
    await page.route('**/v0/reports?**', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      submissions++;
      if (submissions > 1) return acceptReport(route);
      if (failure === 'network') return route.abort('failed');
      if (failure === 'turnstile') {
        expect(route.request().headers()['cf-turnstile-response']).toBeUndefined();
      }
      return route.fulfill({ status: failure === '503' ? 503 : 403, json: {} });
    });

    await submitButton(page).click();
    // Optimistic success unmounts the footer; failure restores it with the original selection.
    await expect.poll(() => submissions).toBe(1);
    await continueWithoutLocation(page);
    await expect(submitButton(page)).toBeEnabled();
    expect(await lastReportAt(page)).toBe(oldTimestamp);
    await expect(page.getByRole('button', { name: 'Test station', exact: true })).toBeVisible();

    await submitButton(page).click();
    await expect.poll(() => submissions).toBe(2);
    await expect.poll(() => lastReportAt(page)).not.toBe(oldTimestamp);
  });
}

test('pending close/reopen and repeated clicks send once; confirmed success starts the cooldown', async ({
  page,
}) => {
  let submissions = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v0/reports?**', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    submissions++;
    if (submissions === 1) await held;
    await acceptReport(route);
  });
  await submitButton(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
  });
  await expect.poll(() => submissions).toBe(1);
  await expect(page.getByRole('heading', { name: 'Thank you for your report!' })).toBeVisible();
  expect(await lastReportAt(page)).toBeNull();

  await reopenForm(page);
  await expect(submitButton(page)).toBeDisabled();
  expect(submissions).toBe(1);
  expect(await lastReportAt(page)).toBeNull();

  const confirmedAt = Date.now();
  release();
  await expect.poll(() => lastReportAt(page)).not.toBeNull();
  expect(Number(await lastReportAt(page))).toBeGreaterThanOrEqual(confirmedAt);
  await expect(submitButton(page)).toBeEnabled();
  await expect(page.getByRole('status')).toHaveCount(0);
  await submitButton(page).click();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(submitButton(page)).toBeVisible();
  expect(submissions).toBe(1);

  await page.clock.setFixedTime(Number(await lastReportAt(page)) + COOLDOWN_MS);
  await submitButton(page).click();
  await expect.poll(() => submissions).toBe(2);
});

test('a paused offline attempt is not persisted as a pending submission after reload', async ({
  page,
}) => {
  // Trigger Query's offline state while leaving the local test server available for the reload.
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  const attemptedAt = Date.now();
  await submitButton(page).click();
  await expect(page.getByRole('heading', { name: 'Thank you for your report!' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async (attemptedAt) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('keyval-store');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const stored = await new Promise<string | undefined>((resolve, reject) => {
            const request = database
              .transaction('keyval', 'readonly')
              .objectStore('keyval')
              .get('freifahren-query-cache');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          if (!stored) return null;
          const cache = JSON.parse(stored);
          return cache.timestamp >= attemptedAt ? cache.clientState.mutations.length : null;
        } finally {
          database.close();
        }
      }, attemptedAt),
    )
    .toBe(0);
  await page.reload();
  await continueWithoutLocation(page);
  await expect(submitButton(page)).toBeEnabled();
  expect(await lastReportAt(page)).toBeNull();

  let submissions = 0;
  await page.route('**/v0/reports?**', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    submissions++;
    await acceptReport(route);
  });
  await submitButton(page).click();
  await expect.poll(() => submissions).toBe(1);
  await expect.poll(() => lastReportAt(page)).not.toBeNull();
});
