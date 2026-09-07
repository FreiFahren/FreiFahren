import { expect, test } from '@playwright/test';

import { CITY_SLUGS } from '../../cities/src';

test.skip(!process.env.E2E_BASE_URL || !process.env.E2E_API_URL, 'Requires an all-city preview');
test.describe.configure({ mode: 'parallel' });
test.use({ locale: 'en-GB' });

for (const city of CITY_SLUGS) {
  for (const viewport of [
    { width: 1280, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    test(`${city}: every line at ${viewport.width}x${viewport.height}`, async ({
      page,
      request,
    }) => {
      test.setTimeout(600_000);
      const response = await request.get(
        `${process.env.E2E_API_URL}/v0/transit/lines?city=${city}`,
      );
      expect(response.ok()).toBe(true);
      const lines = (await response.json()) as Array<{ name: string }>;
      const names = [...new Set(lines.map((line) => line.name))];
      expect(names.length).toBeGreaterThan(0);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.setViewportSize(viewport);
      await page.addInitScript(() => {
        localStorage.setItem('legalDisclaimerAcceptedAt', new Date().toISOString());
      });
      for (const name of names) {
        await test.step(name, async () => {
          await page.goto(`/line/${encodeURIComponent(name)}?city=${city}`);
          const chart = page.getByRole('img', { name: /Reports by hour/ });
          await expect(chart).toBeVisible();
          await page.waitForLoadState('networkidle');
          const cta = page.getByRole('link', {
            name: `Report sighting on the ${name}`,
            exact: true,
          });
          const card = page.locator('[data-slot="card"]').filter({ has: cta });
          await card.evaluate((element) => {
            element.style.animation = 'none';
          });
          const scroller = card.locator(
            'section[aria-labelledby="line-hotspots-heading"] .overflow-y-auto',
          );
          await expect(cta).toBeInViewport();
          const bounds = (await card.boundingBox())!;
          expect(bounds.height).toBeCloseTo(Math.min(608, viewport.height - 48), 0);
          expect(bounds.x).toBeGreaterThanOrEqual(0);
          expect(bounds.y).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
          expect(await card.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(
            1,
          );
          expect(await scroller.evaluate((el) => el.clientHeight)).toBeGreaterThan(0);
          expect(
            await scroller.evaluate((el) => el.scrollWidth - el.clientWidth),
          ).toBeLessThanOrEqual(1);

          const groups = scroller.getByRole('button', { expanded: false });
          if (await groups.count()) {
            await expect
              .poll(() =>
                scroller.evaluate(
                  (el) => el.clientHeight - el.firstElementChild!.getBoundingClientRect().height,
                ),
              )
              .toBeLessThan(32);
            const initialCard = await card.boundingBox();
            const initialCta = await cta.boundingBox();
            await groups.first().click();
            await expect(scroller.getByRole('button', { expanded: true })).toBeVisible();
            expect(await card.boundingBox()).toEqual(initialCard);
            expect(await cta.boundingBox()).toEqual(initialCta);
            await scroller.evaluate((el) => {
              el.scrollTop = el.scrollHeight;
            });
            await expect(scroller.locator('a, button').last()).toBeInViewport();
            await scroller.getByRole('button', { expanded: true }).click();
            await expect(cta).toBeInViewport();
          }
          const station = scroller.getByRole('link').first();
          if (await station.count()) {
            await station.click();
            await expect(page).toHaveURL(/\/station\//);
            await expect(page.getByRole('link', { name: /Report sighting/ })).toBeVisible();
            await page.goBack();
            await expect(chart).toBeVisible();
            await page.waitForLoadState('networkidle');
          }
          await cta.click();
          await expect(page).toHaveURL(/\/report\?/);
          await expect(
            page.getByRole('heading', { name: 'Report sighting', exact: true }),
          ).toBeVisible();
        });
      }
      expect(errors).toEqual([]);
      console.log(`Verified ${names.length} ${city} lines at ${viewport.width}x${viewport.height}`);
    });
  }
}
