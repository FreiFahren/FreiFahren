import { expect, test } from '@playwright/test';

test.use({ locale: 'en-GB', timezoneId: 'Europe/Berlin' });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-06T20:12:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('legalDisclaimerAcceptedAt', new Date().toISOString());
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
  { width: 390, height: 568 },
]) {
  test(`line chart and expandable hotspots at ${viewport.width}x${viewport.height}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto('/line/U7?city=berlin');
    const chart = page.getByRole('img', { name: /Reports by hour/ });
    await expect(chart).toBeVisible();
    for (const hour of [0, 6, 12, 18, 24]) {
      await expect(chart.getByText(`${hour}h`, { exact: true })).toBeVisible();
    }
    const positions = await chart.evaluate((element) => {
      const plot = element.firstElementChild!;
      const bounds = plot.getBoundingClientRect();
      const marker = plot.querySelector('span')!.getBoundingClientRect();
      const label = [...element.querySelectorAll('span')]
        .find((span) => span.textContent === '18h')!
        .getBoundingClientRect();
      return {
        marker: (marker.x - bounds.x) / bounds.width,
        label: (label.x + label.width / 2 - bounds.x) / bounds.width,
      };
    });
    expect(positions.label).toBeCloseTo(0.75, 2);
    expect(positions.marker).toBeGreaterThan(22 / 24);
    expect(positions.marker).toBeLessThan(23 / 24);

    const card = page.locator('[data-slot="card"]').filter({ has: chart });
    const cta = card.getByRole('link', { name: 'Report sighting on the U7' });
    const hotspots = card.locator('section').last();
    const scroller = hotspots.locator('.overflow-y-auto');
    await expect(cta).toBeInViewport();
    const initialHeight = (await card.boundingBox())!.height;
    const dimensions = await scroller.evaluate((element) => ({
      height: element.clientHeight,
      content: element.scrollHeight,
    }));
    expect(dimensions.height).toBeGreaterThan(0);
    expect(dimensions.content - dimensions.height).toBeGreaterThanOrEqual(0);
    // A collapsed list should leave no unused space before the report button.
    if (viewport.height >= 844) {
      expect(initialHeight).toBeLessThan(608);
      const gap = await scroller.evaluate(
        (element) =>
          element.clientHeight - element.firstElementChild!.getBoundingClientRect().height,
      );
      expect(gap).toBeLessThan(8);
    }
    await page.screenshot({ path: testInfo.outputPath('collapsed.png') });
    const groups = hotspots.getByRole('button', { expanded: false });
    const count = await groups.count();
    for (let index = 0; index < count; index++) await groups.first().click();
    await expect(cta).toBeInViewport();
    expect((await card.boundingBox())!.height).toBeLessThanOrEqual(
      Math.min(608, viewport.height - 48) + 1,
    );
    if (count) {
      await scroller.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(hotspots.getByRole('link').last()).toBeInViewport();
      await page.screenshot({ path: testInfo.outputPath('expanded.png') });
      const expanded = hotspots.getByRole('button', { expanded: true });
      for (let index = 0; index < count; index++) await expanded.first().click();
      expect((await card.boundingBox())!.height).toBeCloseTo(initialHeight, 0);
    }
    const station = hotspots.getByRole('link').first();
    if (await station.count()) {
      await station.click();
      await expect(page).toHaveURL(/\/station\//);
      await expect(page.getByRole('link', { name: /Report sighting/ })).toBeVisible();
      await page.goBack();
      await expect(chart).toBeVisible();
    }
    await cta.click();
    await expect(page).toHaveURL(/\/report\?.*lineName=U7/);
  });
}
