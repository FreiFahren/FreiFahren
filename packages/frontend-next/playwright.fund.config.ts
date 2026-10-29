import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'fund-upload.spec.ts',
  outputDir: process.env.FUND_TEST_OUTPUT ?? '/tmp/freifahren-fund-test-results',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:1871',
    locale: 'de-DE',
    serviceWorkers: 'block',
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:1871',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_AUTH_URL: 'http://localhost:8788',
      VITE_FUND_URL: 'http://localhost:8789',
      VITE_API_URL: 'http://localhost:8787',
      VITE_PREVIEW: 'true',
      VITE_POSTHOG_KEY: '',
      VITE_SENTRY_DSN: '',
      VITE_TURNSTILE_SITE_KEY: '',
    },
  },
  projects: [
    {
      name: 'small-phone-320',
      use: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'small-phone-375',
      use: { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
    },
  ],
});
