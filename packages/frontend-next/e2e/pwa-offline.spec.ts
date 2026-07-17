import { expect, test } from '@playwright/test';

test('serves the cached shell offline and fetches a fresh shell when online', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext();
  const onlinePage = await context.newPage();

  const firstResponse = await onlinePage.goto(`${baseURL}/?pwa-e2e=first`);
  expect(firstResponse?.headers()['x-pwa-e2e-shell-revision']).toBeDefined();
  await expect(onlinePage.locator('#root > *')).not.toHaveCount(0);
  const apiResponse = await onlinePage.evaluate(async () => {
    const response = await fetch('http://localhost:8787/v0/transit/stations?city=berlin');
    return { ok: response.ok, stationCount: Object.keys(await response.json()).length };
  });
  expect(apiResponse.ok).toBe(true);
  expect(apiResponse.stationCount).toBeGreaterThan(0);
  await onlinePage.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect
    .poll(() =>
      onlinePage.evaluate(async () => {
        const cache = await caches.open('app-shell');
        return Boolean(await cache.match('/'));
      }),
    )
    .toBe(true);
  const cachedRevision = await onlinePage.evaluate(async () => {
    const cache = await caches.open('app-shell');
    return (await cache.match('/'))?.headers.get('x-pwa-e2e-shell-revision');
  });
  expect(cachedRevision).toBeDefined();

  await context.setOffline(true);
  const offlinePage = await context.newPage();
  const cachedResponse = await offlinePage.goto(`${baseURL}/`);
  expect(cachedResponse?.headers()['x-pwa-e2e-shell-revision']).toBe(cachedRevision);
  await expect(offlinePage.locator('#root > *')).not.toHaveCount(0);

  await context.setOffline(false);
  const freshResponse = await offlinePage.goto(`${baseURL}/?pwa-e2e=after-reconnect`);
  expect(Number(freshResponse?.headers()['x-pwa-e2e-shell-revision'])).toBeGreaterThan(
    Number(cachedRevision),
  );

  await context.close();
});
