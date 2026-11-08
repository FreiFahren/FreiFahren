import { expect, test, type Page } from '@playwright/test';

test.skip(!process.env.PREVIEW_URL, 'Requires an isolated preview or local frontend');

test.beforeEach(async ({ page }) => {
  // These public routes need no onboarding acceptance; the tests never submit data.
  await page.route('**/*', (route) =>
    ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort(),
  );
});

async function expectGrayEdges(page: Page, top: number, bottom: number) {
  const screenshot = await page.screenshot();
  const colors = await page.evaluate(
    async ({ image, top, bottom }) => {
      const decoded = new Image();
      decoded.src = `data:image/png;base64,${image}`;
      await decoded.decode();
      const canvas = document.createElement('canvas');
      canvas.width = decoded.width;
      canvas.height = decoded.height;
      const context = canvas.getContext('2d')!;
      context.drawImage(decoded, 0, 0);
      const scale = decoded.width / innerWidth;
      const pixel = (y: number) =>
        Array.from(
          context.getImageData(Math.floor(decoded.width / 2), Math.floor(y * scale), 1, 1).data,
        );
      return [pixel(top), pixel(innerHeight - bottom)];
    },
    { image: screenshot.toString('base64'), top, bottom },
  );
  expect(colors).toEqual([
    [37, 39, 43, 255],
    [37, 39, 43, 255],
  ]);
}

test('page edges stay gray across sheets, modal dimming, and full-page navigation', async ({
  page,
}, testInfo) => {
  const isIosSafari = testInfo.project.name === 'mobile-safari';
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  expect(
    await page.evaluate(() =>
      [document.documentElement, document.body].map(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    ),
  ).toEqual(['rgb(37, 39, 43)', 'rgb(37, 39, 43)']);
  const edges = page.locator('[data-slot="safe-area-background"]');
  for (const edge of await edges.all()) {
    await expect(edge).toHaveCSS('pointer-events', 'none');
    await expect(edge).toHaveCSS('height', isIosSafari ? '6px' : '0px');
  }
  if (isIosSafari) await expectGrayEdges(page, 2, 2);

  // Existing native keyboard events set this variable. The edge surfaces must not move the sheet.
  const sheet = page.locator('[data-slot="card"]').last();
  await page.evaluate(() =>
    document.documentElement.style.setProperty('--keyboard-inset', '280px'),
  );
  await expect
    .poll(async () => {
      const bounds = await sheet.boundingBox();
      return Math.round(bounds!.y + bounds!.height);
    })
    .toBe(page.viewportSize()!.height - 280);
  await page.evaluate(() => document.documentElement.style.removeProperty('--keyboard-inset'));

  // WebKit emulation has no physical notch. Simulate the painted bands to test stacking.
  await page.locator('[data-slot="safe-area-background"]').evaluateAll((elements) => {
    for (const element of elements) {
      (element as HTMLElement).style.height =
        element.getAttribute('data-edge') === 'top' ? '59px' : '34px';
    }
  });
  await expectGrayEdges(page, 25, 15);
  await page.getByRole('button', { name: 'Terms of Use', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  await expectGrayEdges(page, 25, 15);
  await page
    .getByRole('dialog')
    .locator('[data-slot="card"]')
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expectGrayEdges(page, 25, 15);

  const reportHeading = page.getByRole('heading', { name: 'Report sighting', exact: true });
  // Use the app router so the same root edge surfaces survive the route transition.
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.waitForURL('**/');
  await expectGrayEdges(page, 25, 15);
  await page.goto('/report');
  await expect(reportHeading).toBeVisible();
  if (isIosSafari) await expectGrayEdges(page, 2, 2);
});

test('tall sheets keep Close clear of actual CSS safe areas and keyboard spacing', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CSS env override requires the Chromium protocol');
  const protocol = await context.newCDPSession(page);
  await protocol.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: 59, bottom: 34, left: 0, right: 0 },
  });
  for (const { height, keyboard } of [
    { height: 400, keyboard: 0 },
    { height: 664, keyboard: 280 },
  ]) {
    await page.setViewportSize({ width: 390, height });
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await page.evaluate((inset) => {
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
    }, keyboard);
    const sheet = page.locator('[data-slot="card"]').last();
    await expect
      .poll(async () => {
        const bounds = (await sheet.boundingBox())!;
        return {
          x: bounds.x,
          top: Math.round(bounds.y),
          width: bounds.width,
          bottom: Math.round(bounds.y + bounds.height),
        };
      })
      .toEqual({ x: 0, top: 71, width: 390, bottom: height - keyboard });
    await expectGrayEdges(page, 25, 15);
    const close = sheet.getByRole('button', { name: 'Close', exact: true });
    expect(
      await close.evaluate((button) => {
        const bounds = button.getBoundingClientRect();
        return (
          bounds.y >= 59 &&
          document
            .elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
            ?.closest('button') === button
        );
      }),
    ).toBe(true);
    expect(
      await sheet.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return element.scrollTop;
      }),
    ).toBeGreaterThan(0);
    await sheet.evaluate((element) => {
      element.scrollTop = 0;
    });
    await close.click();
    await page.waitForURL('**/');
  }
});
