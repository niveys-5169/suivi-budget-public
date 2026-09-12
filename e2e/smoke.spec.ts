import { test, expect } from '@playwright/test';

/**
 * Smoke tests — verify the app shell loads without console errors.
 * These don't require Firebase auth; they validate the index.html / boot path
 * and that the React bundle wires up correctly.
 */
test.describe('AURUM smoke', () => {
  test('loads the index document with the expected title and shell', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/AURUM/i);

    // Critical DOM landmarks rendered by index.html.
    await expect(page.locator('#app-root')).toBeAttached();
    await expect(page.locator('#login-screen')).toBeAttached();
  });

  test('exposes PWA manifest and theme-color', async ({ page }) => {
    await page.goto('/');
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#0B0B14');

    const iconHref = await page
      .locator('link[rel="icon"][type="image/svg+xml"]')
      .getAttribute('href');
    expect(iconHref).toMatch(/icon.*\.svg/);

    const manifestResponse = await page.request.get('/manifest.webmanifest');
    expect(manifestResponse.ok()).toBeTruthy();
    const manifest = await manifestResponse.json();
    expect(manifest.name).toMatch(/AURUM/i);
    expect(manifest.display).toBe('standalone');
  });

  test('does not surface critical console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    // Give the SPA a beat to mount React without auth (login screen will appear).
    await page.waitForLoadState('networkidle');

    // Ignore expected Firebase-auth noise when no user is signed in.
    const blocking = errors.filter(
      (e) =>
        !/firebase|firestore|missing or insufficient permissions|auth\/.*/i.test(e) &&
        !/Failed to load resource/i.test(e),
    );
    expect(blocking, `Unexpected console errors:\n${blocking.join('\n')}`).toEqual([]);
  });

  test('renders the skip-link for keyboard users (WCAG 2.4.1)', async ({ page }) => {
    await page.goto('/');
    // The skip-link is sr-only until focused.
    const skipLink = page.getByRole('link', { name: /Aller au contenu principal/i });
    await expect(skipLink).toBeAttached();
  });
});
