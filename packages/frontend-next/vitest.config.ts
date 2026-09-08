import path from 'node:path';

import { defineConfig } from 'vitest/config';

/*
 * Unit tests for the app's pure logic. Component and flow coverage stays with Playwright
 * (`e2e/`, run by `bun run test`), which is why this only picks up `src/` and needs no DOM
 * environment — everything tested here is free of React and the browser.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@freifahren/cities': path.resolve(__dirname, '../cities/src/index.ts'),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // api/transit reads this at module load, the same reason playwright.config sets it.
    env: { VITE_API_URL: 'http://localhost:8787' },
  },
});
