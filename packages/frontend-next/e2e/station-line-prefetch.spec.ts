import { expect, test } from '@playwright/test';

test('prefetches each served line once and reuses it during navigation', async ({ page }) => {
  let lineInsightRequests = 0;
  await page.route('**/v0/transit/stations?**', (route) =>
    route.fulfill({
      json: {
        test: {
          name: 'Test Station',
          coordinates: { latitude: 52.5, longitude: 13.4 },
          lines: ['u7-a', 'u7-b'],
        },
      },
    }),
  );
  await page.route('**/v0/transit/lines?**', (route) =>
    route.fulfill({
      json: [
        {
          id: 'u7-a',
          name: 'U7',
          type: 'subway',
          isCircular: false,
          color: '#528dba',
          stations: ['test'],
        },
        {
          id: 'u7-b',
          name: 'U7',
          type: 'subway',
          isCircular: false,
          color: '#528dba',
          stations: ['test'],
        },
      ],
    }),
  );
  await page.route('**/v0/reports?**', (route) => route.fulfill({ json: [] }));
  await page.route('**/v0/insights/station/test?**', (route) =>
    route.fulfill({
      json: {
        reportCount: {
          value: 0,
          range: { start: '2026-07-14T00:00:00.000Z', end: '2026-07-21T00:00:00.000Z' },
        },
        ranking: { position: 1, population: 1 },
      },
    }),
  );
  await page.route('**/v0/insights/lines/U7?**', async (route) => {
    lineInsightRequests += 1;
    await route.fulfill({
      json: {
        line: { name: 'U7', variantCount: 2 },
        profile: {
          source: 'line_reports',
          metric: {
            name: 'report_count',
            range: { start: '2026-04-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' },
          },
          weekday: 1,
          hours: [{ hour: 12, value: 1 }],
        },
        hotspots: {
          source: 'reports',
          metric: {
            name: 'report_count',
            range: { start: '2026-04-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' },
          },
          stations: [{ stationId: 'test', name: 'Test Station', value: 1, share: 1 }],
        },
      },
    });
  });

  await page.goto('/station/test');
  await page.getByRole('dialog').getByRole('button').click();
  await expect.poll(() => lineInsightRequests).toBe(1);

  await page.getByRole('link', { name: /U7/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Usual hotspots')).toBeVisible();
  expect(lineInsightRequests).toBe(1);
});
