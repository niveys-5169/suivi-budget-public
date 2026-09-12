import { test, expect } from '@playwright/test';

/**
 * Mobile PWA — AppRouter routing tests
 *
 * These tests run WITHOUT Firebase credentials (same constraint as smoke.spec.ts).
 * Both MainApp and MobileApp now hide the static #loader and show #login-screen
 * once auth resolves (consistent UX, fixes PWA-stuck-on-Firestore bug).
 *
 * Authenticated-screen tests (bounding-box assertions on hero/header/nav) require
 * a Firebase emulator setup and are deferred to a future e2e suite.
 */

// Waiting for auth to settle after networkidle (Firebase onAuthStateChanged async)
const AUTH_SETTLE_MS = 3_000;

test.describe('iPhone 15 Pro — mobile routing (393px)', () => {
  test.use({ viewport: { width: 393, height: 659 } });

  test('no critical console errors at mobile viewport', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const blocking = errors.filter(
      (e) =>
        !/firebase|firestore|missing or insufficient permissions|auth\/.*/i.test(e) &&
        !/Failed to load resource/i.test(e),
    );
    expect(blocking, `Unexpected console errors:\n${blocking.join('\n')}`).toEqual([]);
  });

  test('PWA: hides #loader once auth resolves (regression: stuck on Firestore)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(AUTH_SETTLE_MS);
    // Critical: without MobileApp's hideLoader() useEffect, PWA stays on
    // "Interrogation Firestore..." forever in standalone mode.
    await expect(page.locator('#loader')).toBeHidden();
  });

  test('shows #login-screen when not authenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(AUTH_SETTLE_MS);
    await expect(page.locator('#login-screen')).toBeVisible();
  });

  test('?ui=desktop override does not crash at mobile viewport', async ({ page }) => {
    await page.goto('/?ui=desktop');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(AUTH_SETTLE_MS);
    await expect(page.locator('#loader')).toBeHidden();
    await expect(page.locator('#login-screen')).toBeVisible();
  });

  test('PWA meta tags intact', async ({ page }) => {
    await page.goto('/');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBe(
      'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1',
    );
    const statusBar = await page
      .locator('meta[name="apple-mobile-web-app-status-bar-style"]')
      .getAttribute('content');
    expect(statusBar).toBe('black-translucent');
  });
});

test.describe('Desktop 1280px — desktop routing', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('hides #loader once auth resolves', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(AUTH_SETTLE_MS);
    await expect(page.locator('#loader')).toBeHidden();
  });

  test('shows #login-screen when not authenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(AUTH_SETTLE_MS);
    await expect(page.locator('#login-screen')).toBeVisible();
  });

  test('?ui=mobile override does not crash at desktop viewport', async ({ page }) => {
    await page.goto('/?ui=mobile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(AUTH_SETTLE_MS);
    await expect(page.locator('#loader')).toBeHidden();
    await expect(page.locator('#login-screen')).toBeVisible();
  });
});

test.describe('SE breakpoint — 360px', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('hides #loader at smallest viewport', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(AUTH_SETTLE_MS);
    await expect(page.locator('#loader')).toBeHidden();
  });
});
