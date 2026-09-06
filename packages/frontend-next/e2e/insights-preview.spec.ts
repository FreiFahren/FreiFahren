import { expect, test, type APIRequestContext } from '@playwright/test';

test.skip(!process.env.PREVIEW_URL || !process.env.PREVIEW_API_URL, 'Requires an isolated preview');
const api = process.env.PREVIEW_API_URL!;
const isBatch = (url: string) => new URL(url).pathname === '/v0/insights/lines';
const isSingle = (url: string) => new URL(url).pathname.startsWith('/v0/insights/lines/');

async function stationFixture(request: APIRequestContext, city: string) {
  const [stationsResponse, linesResponse] = await Promise.all([
    request.get(`${api}/v0/transit/stations?city=${city}`),
    request.get(`${api}/v0/transit/lines?city=${city}`),
  ]);
  expect(stationsResponse.ok()).toBe(true);
  expect(linesResponse.ok()).toBe(true);
  const stations = (await stationsResponse.json()) as Record<
    string,
    { name: string; lines: string[] }
  >;
  const lines = (await linesResponse.json()) as Array<{ id: string; name: string }>;
  const nameById = new Map(lines.map((line) => [line.id, line.name]));
  const candidates = Object.entries(stations).map(([id, station]) => ({
    id,
    name: station.name,
    names: [
      ...new Set(
        station.lines.map((id) => nameById.get(id)).filter((name): name is string => !!name),
      ),
    ],
  }));
  candidates.sort((a, b) => b.names.length - a.names.length);
  expect(candidates[0].names.length).toBeGreaterThan(1);
  return candidates[0];
}

// Response timestamps can differ between separately cached requests; their historical data must agree.
function historicalData(insight: Record<string, unknown>) {
  const data = structuredClone(insight) as {
    profile: { metric: { range: { end?: string } } };
    hotspots: { metric: { range: { end?: string } } };
  };
  delete data.profile.metric.range.end;
  delete data.hotspots.metric.range.end;
  return data;
}

for (const city of ['berlin', 'hamburg', 'leipzig']) {
  test(`${city}: batch agrees with individual line responses`, async ({ request }) => {
    const station = await stationFixture(request, city);
    const batch = await request.get(
      `${api}/v0/insights/lines?names=${encodeURIComponent(station.names.sort().join(','))}&city=${city}`,
    );
    expect(batch.ok()).toBe(true);
    expect(batch.headers()['cloudflare-cdn-cache-control']).toMatch(/max-age=\d+/);
    const insights = await batch.json();
    expect(insights).toHaveLength(station.names.length);
    for (const insight of insights) {
      const single = await request.get(
        `${api}/v0/insights/lines/${encodeURIComponent(insight.line.name)}?city=${city}`,
      );
      expect(single.ok()).toBe(true);
      expect(historicalData(insight)).toEqual(historicalData(await single.json()));
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('legalDisclaimerAcceptedAt', new Date().toISOString()),
  );
});

test('one preload serves every line, warm navigation and returning to the station', async ({
  page,
  request,
}) => {
  const station = await stationFixture(request, 'berlin');
  const batches: string[] = [];
  const singles: string[] = [];
  page.on('request', (request) => {
    if (isBatch(request.url())) batches.push(request.url());
    if (isSingle(request.url())) singles.push(request.url());
  });
  const batch = page.waitForResponse((response) => isBatch(response.url()));
  await page.goto(`/station/${station.id}?city=berlin`);
  expect((await batch).ok()).toBe(true);
  await expect(page.getByRole('heading', { name: station.name, exact: true })).toBeVisible();
  for (const name of station.names.slice(0, 3)) {
    await page.locator(`a[href^="/line/${encodeURIComponent(name)}?"]`).click();
    await expect(page.locator('#line-typical-activity-heading')).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await page.goBack();
    await expect(page.getByRole('heading', { name: station.name, exact: true })).toBeVisible();
  }
  expect(batches).toHaveLength(1);
  expect(singles).toHaveLength(0);
  await page.screenshot({ path: test.info().outputPath('station.png') });
});

test('navigation during an unfinished preload reuses the in-flight request', async ({
  page,
  request,
}) => {
  const station = await stationFixture(request, 'berlin');
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const singles: string[] = [];
  page.on('request', (request) => {
    if (isSingle(request.url())) singles.push(request.url());
  });
  await page.route('**/v0/insights/lines?**', async (route) => {
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  await page.goto(`/station/${station.id}?city=berlin`);
  const name = station.names[0];
  await page.locator(`a[href^="/line/${encodeURIComponent(name)}?"]`).click();
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  release();
  await expect(page.locator('#line-typical-activity-heading')).toBeVisible();
  expect(singles).toHaveLength(0);
  await page.screenshot({ path: test.info().outputPath('line.png') });
});

test('a failed batch retries and leaves line navigation usable', async ({ page, request }) => {
  const station = await stationFixture(request, 'berlin');
  await page.route('**/v0/insights/lines?**', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  const recovered = page.waitForResponse((response) => isSingle(response.url()) && response.ok());
  await page.goto(`/station/${station.id}?city=berlin`);
  await recovered;
  await page.locator(`a[href^="/line/${encodeURIComponent(station.names[0])}?"]`).click();
  await expect(page.locator('#line-typical-activity-heading')).toBeVisible();
});
