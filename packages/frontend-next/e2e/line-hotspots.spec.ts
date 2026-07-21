import { expect, test } from '@playwright/test';

test('shows a non-zero U7 hotspot below one percent truthfully', async ({ page }) => {
  await page.route('**/v0/transit/lines?**', (route) =>
    route.fulfill({
      json: [
        {
          id: 'u7-a',
          name: 'U7',
          type: 'subway',
          isCircular: false,
          color: '#528dba',
          stations: ['rudow', 'zwickauer-damm'],
        },
      ],
    }),
  );
  await page.route('**/v0/transit/stations?**', (route) =>
    route.fulfill({
      json: {
        rudow: {
          name: 'Rudow',
          coordinates: { latitude: 52.4162, longitude: 13.4952 },
          lines: ['u7-a'],
        },
        'zwickauer-damm': {
          name: 'Zwickauer Damm',
          coordinates: { latitude: 52.4233, longitude: 13.4838 },
          lines: ['u7-a'],
        },
      },
    }),
  );
  await page.route('**/v0/insights/lines/U7?**', (route) =>
    route.fulfill({
      json: {
        line: { name: 'U7', variantCount: 1 },
        profile: {
          source: 'line_reports',
          metric: {
            name: 'report_count',
            range: { start: '2026-04-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' },
          },
          weekday: 1,
          hours: [{ hour: 12, value: 251 }],
        },
        hotspots: {
          source: 'reports',
          metric: {
            name: 'report_count',
            range: { start: '2026-04-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' },
          },
          stations: [
            { stationId: 'rudow', name: 'Rudow', value: 250, share: 250 / 251 },
            {
              stationId: 'zwickauer-damm',
              name: 'Zwickauer Damm',
              value: 1,
              share: 1 / 251,
            },
          ],
        },
      },
    }),
  );

  await page.goto('/line/U7');
  await page.getByRole('dialog').getByRole('button').click();
  await page.getByRole('button', { name: /quieter station/ }).click();

  const lowShareStation = page.getByRole('link', { name: /Zwickauer Damm/ });
  await expect(lowShareStation).toContainText('<1%');
  await expect(lowShareStation).not.toContainText('0%');
});
