import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'banking.spec.ts',
  timeout: 30000,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4184', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'banking-desktop',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 900 } },
    },
    {
      name: 'banking-pwa',
      use: {
        browserName: 'chromium',
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js --config e2e/banking.vite.config.ts --host 127.0.0.1',
    url: 'http://127.0.0.1:4184',
    reuseExistingServer: false,
  },
});
