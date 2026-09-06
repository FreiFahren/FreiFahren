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
    await expect(page.getByRole('heading', { name: 'Current activity' })).toBeVisible();
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
    expect(initialHeight).toBeCloseTo(Math.min(512, viewport.height - 48), 0);
    await page.screenshot({ path: testInfo.outputPath('collapsed.png') });
    const groups = hotspots.getByRole('button', { expanded: false });
    const count = await groups.count();
    for (let index = 0; index < count; index++) await groups.first().click();
    await expect(cta).toBeInViewport();
    expect((await card.boundingBox())!.height).toBeLessThanOrEqual(
      Math.min(512, viewport.height - 48) + 1,
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

test('keeps the modal and chart stable while insights and activity arrive separately', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let releaseInsights!: () => void;
  let releaseReports!: () => void;
  const insightsReady = new Promise<void>((resolve) => {
    releaseInsights = resolve;
  });
  const reportsReady = new Promise<void>((resolve) => {
    releaseReports = resolve;
  });
  await page.route('**/insights/lines/U7?*', async (route) => {
    await insightsReady;
    await route.continue();
  });
  await page.route('**/reports?*', async (route) => {
    await reportsReady;
    await route.continue();
  });
  await page.goto('/line/U7?city=berlin');
  const cta = page.getByRole('link', { name: 'Report sighting on the U7' });
  await expect(cta).toBeVisible();
  const card = page.locator('[data-slot="card"]').filter({ has: cta });
  // Disable only the entrance animation so measurements isolate data-driven movement.
  await card.evaluate((element) => {
    element.style.animation = 'none';
  });
  const initialCard = await card.boundingBox();
  const initialCta = await cta.boundingBox();
  const chart = page.getByRole('img', { name: /Reports by hour/ });
  await expect(chart).toHaveCount(0);
  releaseInsights();
  await expect(chart).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Current activity' })).toBeHidden();
  const chartBeforeActivity = await chart.boundingBox();
  expect(await card.boundingBox()).toEqual(initialCard);
  expect(await cta.boundingBox()).toEqual(initialCta);
  releaseReports();
  await expect(page.getByRole('heading', { name: 'Current activity' })).toBeVisible();
  expect(await card.boundingBox()).toEqual(initialCard);
  expect(await cta.boundingBox()).toEqual(initialCta);
  expect(await chart.boundingBox()).toEqual(chartBeforeActivity);
});
