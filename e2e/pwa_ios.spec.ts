import { test, expect } from '@playwright/test';

test('index.html has iOS PWA tags', async ({ page }) => {
  await page.goto('/');

  // Viewport check
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toBe(
    'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1',
  );

  // Manifest link check
  const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestLink).toBe('/manifest.webmanifest');

  // Apple status bar style check
  const statusBarStyle = await page
    .locator('meta[name="apple-mobile-web-app-status-bar-style"]')
    .getAttribute('content');
  expect(statusBarStyle).toBe('black-translucent');
});
