import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'report-cooldown.spec.ts',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:1873',
    locale: 'en-US',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // Both DEV and VITE_PREVIEW bypass cooldown verification. Exercise the production guard
    // with an entirely intercepted API and no analytics or error-reporting credentials.
    command: 'bun run build && bun run preview --host 127.0.0.1 --port 1873',
    url: 'http://127.0.0.1:1873',
    timeout: 180_000,
    env: {
      VITE_PREVIEW: '',
      VITE_API_URL: 'https://report-tests.invalid',
      VITE_AUTH_URL: 'https://report-tests.invalid',
      VITE_MAP_STYLE_URL: 'https://report-tests.invalid/style.json',
      VITE_TURNSTILE_SITE_KEY: 'test-site-key',
      VITE_POSTHOG_KEY: '',
      VITE_SENTRY_DSN: '',
      SENTRY_AUTH_TOKEN: '',
    },
  },
});
