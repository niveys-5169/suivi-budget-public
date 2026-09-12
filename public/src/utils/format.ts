import { formatCurrency } from '../lib/formatters';

export const fmt = (v: number | string): string => {
  const num = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(num)) return '—';
  return formatCurrency(num, 'EUR', 'fr-FR');
};

/**
 * Parse une saisie décimale tolérante (séparateur virgule ou point).
 * Retourne `null` pour une saisie vide ou incomplète (`''`, `'-'`, `','`, `'.'`)
 * afin que le champ puisse rester vide au lieu d'afficher `0`.
 */
export const parseDecimal = (input: string): number | null => {
  const s = input.trim().replace(',', '.');
  if (s === '' || s === '-' || s === '.') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

export const esc = (s: string | null | undefined): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const escJs = (s: string | null | undefined): string =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
