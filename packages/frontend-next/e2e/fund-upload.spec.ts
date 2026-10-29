import { expect, test, type FileChooser, type Page } from '@playwright/test';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

type MembershipStatus = 'active' | 'past_due' | 'canceled' | 'none';
type Fine = {
  id: string;
  status: 'in_review';
  createdAt: string;
  paidAt: null;
  declineReason: null;
};

// These browser integration tests exercise the real route, session/membership gates, rules,
// file input and upload mutation. The private auth/Fund services use synthetic HTTP fixtures.
async function fixture(
  page: Page,
  options: { signedIn?: boolean; status?: MembershipStatus } = {},
) {
  const signedIn = options.signedIn ?? true;
  const fines: Fine[] = [];
  const uploads: string[] = [];
  let failUpload = false;
  await page.addInitScript(
    ({ signedIn }) => {
      localStorage.setItem('i18nextLng', 'de');
      localStorage.setItem('legalDisclaimerAcceptedAt', new Date().toISOString());
      if (signedIn) {
        localStorage.setItem('freifahren-session-token', 'fre-863-test-token');
        localStorage.setItem('freifahren-account-id', 'fre-863-test-user');
        // A pre-existing acknowledgement must never bypass a new upload attempt.
        localStorage.setItem('fund-rules-seen-fre-863-test-user', '1');
      }
    },
    { signedIn },
  );
  await page.route('http://localhost:8788/**', async (route) => {
    await route.fulfill({
      headers: CORS_HEADERS,
      json: signedIn
        ? {
            user: {
              id: 'fre-863-test-user',
              name: 'Test Member',
              email: 'fixture@example.invalid',
              emailVerified: true,
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
            session: {
              id: 'fre-863-test-session',
              userId: 'fre-863-test-user',
              token: 'fre-863-test-token',
              expiresAt: '2099-01-01T00:00:00Z',
              createdAt: '2026-01-01T00:00:00Z',
              updatedAt: '2026-01-01T00:00:00Z',
            },
          }
        : null,
    });
  });
  await page.route('http://localhost:8789/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/membership') {
      await route.fulfill({
        headers: CORS_HEADERS,
        json: {
          status: options.status ?? 'active',
          legalName: null,
          amountCents: 900,
          currentPeriodEnd: '2099-01-01T00:00:00Z',
          cancelAtPeriodEnd: false,
        },
      });
    } else if (path === '/fines' && request.method() === 'POST') {
      uploads.push(request.method());
      if (failUpload) {
        await route.fulfill({
          headers: CORS_HEADERS,
          status: 503,
          json: { code: 'fixture_unavailable' },
        });
      } else {
        const fine: Fine = {
          id: `fixture-fine-${uploads.length}`,
          status: 'in_review',
          createdAt: '2026-10-29T12:00:00Z',
          paidAt: null,
          declineReason: null,
        };
        fines.unshift(fine);
        await route.fulfill({ headers: CORS_HEADERS, status: 201, json: fine });
      }
    } else if (path === '/fines') {
      await route.fulfill({ headers: CORS_HEADERS, json: fines });
    } else {
      await route.fulfill({
        headers: CORS_HEADERS,
        status: 404,
        json: { code: 'unexpected_fixture_request' },
      });
    }
  });
  // No real service, analytics or map request is needed for this isolated Fund route.
  await page.route(/^https:\/\//, (route) => route.abort());
  return {
    uploads,
    failUpload: (value: boolean) => {
      failUpload = value;
    },
  };
}

function uploadButton(page: Page) {
  return page.getByRole('button', { name: 'Knöllchen hochladen', exact: true });
}

function rules(page: Page) {
  return page.getByRole('dialog', { name: 'Was du wissen musst' });
}

async function openRules(page: Page) {
  await uploadButton(page).click();
  await expect(rules(page)).toBeVisible();
}

async function approve(page: Page): Promise<FileChooser> {
  const picker = page.waitForEvent('filechooser');
  await rules(page).getByRole('button', { name: 'Verstanden', exact: true }).click();
  const chooser = await picker;
  await expect(rules(page)).toBeHidden();
  return chooser;
}

const photo = {
  name: 'synthetic-fine.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  ),
};

test('small-phone empty view and mandatory rules have reachable controls without horizontal overflow', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/fund');
  await expect(page.getByRole('heading', { name: 'Noch keine Knöllchen' })).toBeVisible();
  await expect(rules(page)).toBeHidden();
  await expect(uploadButton(page)).toBeInViewport();
  const cta = await uploadButton(page).boundingBox();
  expect(Math.abs(cta!.x + cta!.width / 2 - page.viewportSize()!.width / 2)).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath('empty-view.png') });

  await openRules(page);
  await expect(
    rules(page).getByRole('button', { name: 'Verstanden', exact: true }),
  ).toBeInViewport();
  await expect(
    rules(page).getByRole('button', { name: 'Abbrechen', exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await rules(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: test.info().outputPath('rules-confirmation.png') });
  await rules(page)
    .getByText('Wiederholtes Fahren ohne Ticket kann strafbar sein', { exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    rules(page).getByRole('button', { name: 'Verstanden', exact: true }),
  ).toBeInViewport();
});

test('cancel, Escape and backdrop dismiss without a picker; each attempt starts unapproved', async ({
  page,
}) => {
  await fixture(page);
  let pickers = 0;
  page.on('filechooser', () => {
    pickers += 1;
  });
  await page.goto('/fund');
  await openRules(page);
  await rules(page).getByRole('button', { name: 'Abbrechen', exact: true }).click();
  await expect(rules(page)).toBeHidden();
  await expect(uploadButton(page)).toBeFocused();
  await openRules(page);
  await page.keyboard.press('Escape');
  await expect(rules(page)).toBeHidden();
  await openRules(page);
  await page.mouse.click(1, 1);
  await expect(rules(page)).toBeHidden();
  expect(pickers).toBe(0);
  await openRules(page);
  expect(pickers).toBe(0);
  await approve(page);
  expect(pickers).toBe(1);
});

test('camera-capable platform picker opens once per approval, and canceling the chooser requires approval again', async ({
  page,
}) => {
  await fixture(page);
  let pickers = 0;
  page.on('filechooser', () => {
    pickers += 1;
  });
  await page.goto('/fund');
  await openRules(page);
  expect(pickers).toBe(0);
  const first = await approve(page);
  expect(await first.element().getAttribute('capture')).toBe('environment');
  expect(await first.element().getAttribute('accept')).toBe('image/*');
  expect(pickers).toBe(1);
  // Leave the intercepted chooser without a file, equivalent to dismissing the OS chooser.
  await openRules(page);
  expect(pickers).toBe(1);
  const second = await approve(page);
  await second.setFiles(photo);
  await expect(page.getByRole('table', { name: 'Deine Uploads' })).toBeVisible();
  expect(pickers).toBe(2);
  await openRules(page);
  expect(pickers).toBe(2);
  await approve(page);
  expect(pickers).toBe(3);
});

test('duplicate approval activation cannot open the picker twice', async ({ page }) => {
  await fixture(page);
  let pickers = 0;
  page.on('filechooser', () => {
    pickers += 1;
  });
  await page.goto('/fund');
  await openRules(page);
  const chooser = page.waitForEvent('filechooser');
  await rules(page)
    .getByRole('button', { name: 'Verstanden', exact: true })
    .evaluate((button) => {
      if (!(button instanceof HTMLButtonElement)) throw new Error('Expected approval button');
      button.click();
      button.click();
    });
  await chooser;
  await expect(rules(page)).toBeHidden();
  expect(pickers).toBe(1);
});

test('browser Back and Forward do not retain an open or approved attempt', async ({ page }) => {
  await fixture(page);
  let pickers = 0;
  page.on('filechooser', () => {
    pickers += 1;
  });
  await page.goto('/privacy');
  await page.goto('/fund');
  await openRules(page);
  await page.goBack();
  await expect(page).not.toHaveURL(/\/fund\/?$/);
  expect(pickers).toBe(0);
  await page.goForward();
  await expect(uploadButton(page)).toBeVisible();
  await expect(rules(page)).toBeHidden();
  await openRules(page);
  expect(pickers).toBe(0);
});

test('failed upload can retry its selected file, while choosing again still requires approval', async ({
  page,
}) => {
  const state = await fixture(page);
  state.failUpload(true);
  let pickers = 0;
  page.on('filechooser', () => {
    pickers += 1;
  });
  await page.goto('/fund');
  await openRules(page);
  await (await approve(page)).setFiles(photo);
  await expect(page.getByRole('alert')).toBeVisible();
  expect(state.uploads).toHaveLength(1);
  state.failUpload(false);
  await page.getByRole('button', { name: 'Erneut versuchen', exact: true }).click();
  await expect(page.getByRole('table', { name: 'Deine Uploads' })).toBeVisible();
  expect(state.uploads).toHaveLength(2);
  expect(pickers).toBe(1);
  await openRules(page);
  expect(pickers).toBe(1);
});

for (const scenario of [
  { label: 'signed out', signedIn: false, status: 'active' as const },
  { label: 'not a member', signedIn: true, status: 'none' as const },
  { label: 'canceled member', signedIn: true, status: 'canceled' as const },
]) {
  test(`${scenario.label} cannot bypass the account or membership upload gate`, async ({
    page,
  }) => {
    await fixture(page, scenario);
    await page.goto('/fund');
    await expect(
      page.getByRole('heading', { name: 'FreiFahren Fonds', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(uploadButton(page)).toHaveCount(0);
    await expect(page.locator('input[type=file]')).toHaveCount(0);
    await expect(rules(page)).toBeHidden();
  });
}

test('past-due member keeps the existing upload entitlement and still confirms each attempt', async ({
  page,
}) => {
  await fixture(page, { status: 'past_due' });
  await page.goto('/fund');
  await expect(uploadButton(page)).toBeVisible();
  await openRules(page);
  await approve(page);
  await openRules(page);
});
