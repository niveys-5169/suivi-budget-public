import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright smoke-test config — Sprint 3.3.
 *
 * Goal: catch regressions on the application shell (markup, routing, no console
 * errors) without depending on Firebase / Firestore credentials. Authenticated
 * flows belong in a future e2e suite that runs against an emulator.
 *
 * Run locally:
 *   npx playwright install chromium    # one-time browser download
 *   npm run e2e                        # against the Vite preview server
 *   npm run e2e:ui                     # interactive runner
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
    { name: 'iphone-15-pro', use: { ...devices['iPhone 15 Pro'] } },
  ],

  // Boot the Vite preview server before tests; reuse if already running locally.
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
