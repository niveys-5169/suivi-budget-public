import { test, expect } from '@playwright/test';

test('un import sans nouvelle opération se termine et une suggestion retire le badge', async ({
  page,
}, testInfo) => {
  await page.goto('/connexions');
  await expect(page.getByTestId('operation')).toHaveText('En attente de Linxo');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: `.venv/${testInfo.project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Actualiser les banques et Linxo' }).click();
  await expect(page.getByRole('status', { name: 'Nombre de synchronisations' })).toHaveText('1');
  await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
  await expect(page.getByTestId('operation')).toBeEmpty();
  await expect(page.getByText('CAFE PARIS : retrouvé dans Linxo', { exact: false })).toBeVisible();
});

test('lire une alerte ne résout pas l’expiration bancaire', async ({ page }) => {
  await page.goto('/connexions');
  await page.getByRole('button', { name: 'Centre d’alertes' }).click();
  await expect(page.getByRole('heading', { name: "Centre d'Alertes" })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Alertes bancaires' })).toContainText(
    'reconnexion nécessaire',
  );
  await page.goto('/connexions');
  await expect(page.getByRole('complementary', { name: 'Alertes bancaires' })).toBeVisible();
});

test('retour bancaire et choix de la banque', async ({ page }) => {
  await page.route('https://bank.test/authorize', (route) =>
    route.fulfill({
      status: 302,
      headers: { location: 'http://127.0.0.1:4184/connexions?auth=success' },
      body: '',
    }),
  );
  await page.goto('/connexions');
  await page.getByRole('button', { name: 'Choisir une banque' }).click();
  await page.getByRole('button', { name: 'Se connecter auprès de la banque' }).click();
  await expect(page.getByText('Connexion enregistrée', { exact: true })).toBeVisible();
});

test('le geste vers le bas utilise la synchronisation commune', async ({ page }) => {
  await page.goto('/connexions');
  const surface = page.getByTestId('pull-surface').locator('div').first();
  await surface.dispatchEvent('touchstart', {
    touches: [{ identifier: 1, clientX: 20, clientY: 20 }],
  });
  await surface.dispatchEvent('touchmove', {
    touches: [{ identifier: 1, clientX: 20, clientY: 230 }],
  });
  await surface.dispatchEvent('touchend', { touches: [] });
  await expect(page.getByRole('status', { name: 'Nombre de synchronisations' })).toHaveText('1');
});
