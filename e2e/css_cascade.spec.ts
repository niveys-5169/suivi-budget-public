import { test, expect } from '@playwright/test';

/**
 * Garde-fou de cascade — voir l'en-tête de `public/src/style.css`.
 *
 * `style.css` a longtemps posé `* { margin: 0; padding: 0 }` hors de toute
 * cascade layer. Tailwind v4 émettant l'intégralité de son CSS dans
 * `@layer …`, et une déclaration non layerisée l'emportant sur n'importe quelle
 * layer quelle que soit la spécificité, cette règle écrasait TOUS les
 * utilitaires d'espacement de l'application : textes collés au bord de
 * l'écran, montants et boutons rognés, écrans comme modales.
 *
 * jsdom ne calcule pas la cascade : seul un vrai navigateur peut attraper la
 * régression, d'où ce spec plutôt qu'un test Vitest.
 */
test('les utilitaires d’espacement Tailwind ne sont pas écrasés par un reset hors layer', async ({
  page,
}) => {
  await page.goto('/');

  const spacing = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'px-4 mx-auto';
    probe.style.width = '50px';
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe);
    const result = {
      paddingLeft: computed.paddingLeft,
      paddingRight: computed.paddingRight,
      marginLeft: computed.marginLeft,
    };
    probe.remove();
    return result;
  });

  expect(spacing.paddingLeft).toBe('16px');
  expect(spacing.paddingRight).toBe('16px');
  // `mx-auto` : la marge auto est résolue, donc non nulle dans un body large.
  expect(spacing.marginLeft).not.toBe('0px');
});

test('la page ne déborde pas horizontalement', async ({ page }) => {
  await page.goto('/');

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});
