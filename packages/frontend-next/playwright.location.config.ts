import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'location-sharing.spec.ts',
  use: { baseURL: 'http://localhost:1872' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'bun run dev --port 1872',
    url: 'http://localhost:1872',
    env: { VITE_POSTHOG_KEY: '', VITE_SENTRY_DSN: '' },
  },
});
