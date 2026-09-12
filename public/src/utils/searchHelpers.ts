/**
 * Normalises a string for case-/accent-insensitive substring search.
 *
 * - lowercases
 * - strips diacritics (NFD + combining marks regex)
 * - collapses whitespace runs to a single space
 * - trims
 *
 * Returns '' on any error (defensive against non-string inputs).
 */
export function normalizeSearchValue(value: string): string {
  try {
    if (!value) return '';
    return String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

import { formatCurrency } from '../lib/formatters';

/**
 * Returns every normalised string form an amount can match against in the
 * transaction search bar: signed/unsigned decimals (both `.` and `,`), the
 * fr-FR locale currency formatting (`-29,99 €`), and stripped variants.
 *
 * Useful so a query like "29,99" or "29.99" or "-29,99" matches the same row.
 */
export function buildAmountSearchValues(amount: unknown): string[] {
  try {
    // Reject null/undefined explicitly — `Number(null) === 0` would otherwise
    // surface spurious "0" matches on missing amounts.
    if (amount === null || amount === undefined) return [];
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber)) return [];

    const absoluteAmount = Math.abs(amountNumber);
    const normalizedAmount = amountNumber.toFixed(2);
    const normalizedAbsoluteAmount = absoluteAmount.toFixed(2);

    const frFormatted = formatCurrency(amountNumber);

    return [
      normalizedAmount,
      normalizedAmount.replace('.', ','),
      normalizedAbsoluteAmount,
      normalizedAbsoluteAmount.replace('.', ','),
      String(amountNumber),
      String(absoluteAmount),
      frFormatted,
      frFormatted.replace(/\s/g, ''),
      frFormatted.replace(/€/g, '').trim(),
      frFormatted.replace(/€/g, '').replace(/\s/g, ''),
    ]
      .map(normalizeSearchValue)
      .filter(Boolean);
  } catch {
    return [];
  }
}
