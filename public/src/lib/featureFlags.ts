/// <reference types="vite/client" />
/**
 * Feature Flags — compile-time feature toggles
 *
 * Flags are defined as Vite environment variables (VITE_*)
 * They are statically compiled away (tree-shaken) when false.
 *
 * Usage:
 *   import { FLAGS } from '@/lib/featureFlags';
 *   if (FLAGS.BUDGET_BANKIN) { ... }
 */

export const FLAGS = {
  /** Enable Analyse page with donut charts (Entrées/Sorties/Récurrences) */
  ANALYSE_PAGE: import.meta.env.VITE_ANALYSE_PAGE !== 'false',

  /** Enable Bankin-style Budget redesign (grid + category detail pages) */
  BUDGET_BANKIN: import.meta.env.VITE_BUDGET_BANKIN !== 'false',

  /** Enable updated bottom nav with Analyse tab */
  BOTTOMNAV_V2: true,

  /** Enable Mobile V3 Refonte */
  MOBILE_V3: true,

  /** Enable Cashflow forecast page (projection du solde futur + alerte de creux) */
  CASHFLOW_FORECAST: import.meta.env.VITE_CASHFLOW_FORECAST === 'true',

  /** Enable Financial health score card on the Insights page */
  HEALTH_SCORE: import.meta.env.VITE_HEALTH_SCORE === 'true',
} as const;

/**
 * DEV-ONLY: Override a flag via localStorage for testing
 *
 * Usage in browser console:
 *   setDevFlag('BUDGET_BANKIN', true);
 *
 * Sets localStorage and reloads the page for changes to take effect
 */
export function setDevFlag(key: keyof typeof FLAGS, value: boolean): void {
  if (!import.meta.env.DEV) {
    console.warn('[FLAGS] setDevFlag() only available in development mode');
    return;
  }

  const stored = JSON.parse(localStorage.getItem('__flags_override') || '{}');
  stored[key] = value;
  localStorage.setItem('__flags_override', JSON.stringify(stored));

  console.log(`[FLAGS] Set ${key} = ${value}, reloading...`);
  window.location.reload();
}

/**
 * DEV-ONLY: Apply localStorage overrides to FLAGS
 * Called automatically on app init
 */
function applyDevOverrides(): void {
  if (!import.meta.env.DEV) return;

  const overrides = localStorage.getItem('__flags_override');
  if (!overrides) return;

  try {
    const parsed = JSON.parse(overrides);
    Object.entries(parsed).forEach(([key, value]) => {
      if (key in FLAGS && typeof value === 'boolean') {
        (FLAGS as Record<string, boolean>)[key] = value;
      }
    });
    console.log('[FLAGS] Applied localStorage overrides:', parsed);
  } catch (e) {
    console.error('[FLAGS] Failed to parse localStorage overrides:', e);
  }
}

// Apply overrides on module load
applyDevOverrides();
