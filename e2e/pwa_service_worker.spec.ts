import { test, expect } from '@playwright/test';

/**
 * Garde-fou de régression : le service worker doit s'enregistrer quel que soit
 * le mode d'UI. L'enregistrement passe par `useRegisterSW` (PWAUpdateBanner),
 * monté au niveau d'AppRouter — donc au-dessus du branchement MainApp/MobileApp.
 * Avant ce correctif, la PWA mobile (MobileApp) n'enregistrait aucun SW.
 *
 * Le SW n'est généré qu'au build (devOptions.enabled:false), or la config
 * Playwright sert `npm run build && npm run preview` : le SW est donc actif ici.
 */
const readActiveSWUrl = () =>
  navigator.serviceWorker.ready.then((reg) => reg.active?.scriptURL ?? null);

test.describe('PWA service worker', () => {
  test('registers an active service worker', async ({ page }) => {
    await page.goto('/');
    const scriptURL = await page.evaluate(readActiveSWUrl);
    expect(scriptURL).toMatch(/sw\.js$/);
  });

  test('registers the SW in forced-mobile UI (MobileApp path)', async ({ page }) => {
    await page.goto('/?ui=mobile');
    const scriptURL = await page.evaluate(readActiveSWUrl);
    expect(scriptURL).toMatch(/sw\.js$/);
  });
});
