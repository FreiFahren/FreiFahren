import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './node_modules/.cache/auth-pin-results',
  testMatch: 'auth-pin.spec.ts',
  use: {
    baseURL: 'http://127.0.0.1:1873',
    locale: 'en-US',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'bun run dev --host 127.0.0.1 --port 1873 --strictPort',
    url: 'http://127.0.0.1:1873',
    env: {
      VITE_API_URL: 'http://127.0.0.1:1873',
      VITE_AUTH_URL: 'http://127.0.0.1:1873',
      VITE_POSTHOG_KEY: '',
      VITE_TURNSTILE_SITE_KEY: '',
      VITE_SENTRY_DSN: '',
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
