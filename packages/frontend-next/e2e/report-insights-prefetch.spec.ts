import { expect, test } from '@playwright/test';

test('prefetches the report station and line without duplicate requests', async ({ page }) => {
  let stationInsightRequests = 0;
  let lineInsightRequests = 0;
  await page.route('**/v0/transit/stations?**', (route) =>
    route.fulfill({
      json: {
        test: {
          name: 'Test Station',
          coordinates: { latitude: 52.5, longitude: 13.4 },
          lines: ['u7-a'],
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
      ],
    }),
  );
  await page.route('**/v0/reports?**', (route) =>
    route.fulfill({
      json: [
        {
          timestamp: '2026-07-21T12:00:00.000Z',
          stationId: 'test',
          directionId: null,
          lineId: 'u7-a',
          isPredicted: false,
        },
      ],
    }),
  );
  await page.route('**/v0/reports/test?**', (route) => route.fulfill({ json: [] }));
  await page.route('**/v0/insights/station/test?**', async (route) => {
    stationInsightRequests += 1;
    await route.fulfill({
      json: {
        reportCount: {
          value: 1,
          range: { start: '2026-07-14T00:00:00.000Z', end: '2026-07-21T00:00:00.000Z' },
        },
        ranking: { position: 1, population: 1 },
      },
    });
  });
  await page.route('**/v0/insights/lines/U7?**', async (route) => {
    lineInsightRequests += 1;
    await route.fulfill({
      json: {
        line: { name: 'U7', variantCount: 1 },
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

  await page.goto('/reports/test');
  await page.getByRole('dialog').getByRole('button').click();

  await expect.poll(() => stationInsightRequests).toBe(1);
  await expect.poll(() => lineInsightRequests).toBe(1);
});
