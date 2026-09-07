import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:1871',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'bun run build && node e2e/pwa-test-server.mjs',
      url: 'http://localhost:1871/health',
      reuseExistingServer: false,
      env: {
        VITE_API_URL: 'http://localhost:8787',
        VITE_POSTHOG_KEY: '',
        VITE_SENTRY_DSN: '',
      },
    },
    {
      command: 'node e2e/pwa-api-server.mjs',
      url: 'http://localhost:8787/v0/transit/stations?city=berlin',
      reuseExistingServer: false,
    },
  ],
});
