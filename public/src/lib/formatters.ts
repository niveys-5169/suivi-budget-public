/**
 * @file formatters.ts
 * @description Utilitaires de formatage pour les données bancaires (devises, IBAN, dates).
 */

import { Currency } from '../types/banking.types';

const formatterCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const optionsKey = Object.keys(options)
    .sort()
    .map((k) => `${k}:${options[k as keyof Intl.NumberFormatOptions]}`)
    .join('|');
  const key = `${locale}-${optionsKey}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, formatter);
  }
  return formatter;
};

/**
 * Formate un montant en devise avec support multi-devises et variantes tabulaires.
 */
export const formatCurrency = (
  amount: number,
  currency: Currency = 'EUR',
  locale: string = 'fr-FR',
  options: Omit<Intl.NumberFormatOptions, 'style' | 'currency'> = {},
): string => {
  const minDigits =
    options.minimumFractionDigits !== undefined
      ? options.minimumFractionDigits
      : options.maximumFractionDigits !== undefined
        ? Math.min(2, options.maximumFractionDigits)
        : 2;
  const maxDigits =
    options.maximumFractionDigits !== undefined
      ? options.maximumFractionDigits
      : Math.max(minDigits, 2);

  return getFormatter(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
    ...options,
  }).format(amount);
};

/**
 * Masque un IBAN pour ne laisser que les 4 derniers caractères.
 * @example FR76 1234 ... 5678 -> •••• 5678
 */
export const formatMaskedIban = (iban: string): string => {
  const cleanIban = iban.replace(/\s/g, '');
  const lastFour = cleanIban.slice(-4);
  return `•••• ${lastFour}`;
};

/**
 * Formate un pourcentage à la française : « 8,3 % » (espace insécable avant %).
 * `pct` est exprimé en points de pourcentage (8.3 → « 8,3 % », pas 0.083).
 * `decimals` est un nombre fixe de décimales (comme `toFixed`), 1 par défaut.
 * `signed` préfixe « + » aux valeurs positives (zéro exclu).
 */
export const formatPercent = (
  pct: number,
  { decimals = 1, signed = false }: { decimals?: number; signed?: boolean } = {},
): string =>
  getFormatter('fr-FR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: signed ? 'exceptZero' : 'auto',
    // `+ 0` normalise -0 (ex. 0 / base négative) : Intl afficherait « -0,0 % », toFixed « 0.0 ».
  }).format(pct / 100 + 0);

/**
 * Montant compact pour les graduations d'axes : 1 234 → « 1,2 k € », 1 500 000 → « 1,5 M € ».
 */
export const formatCompactCurrency = (value: number): string =>
  getFormatter('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);

/**
 * Nombre décimal à la française avec un nombre fixe de décimales (virgule, espace fine insécable
 * pour les milliers) : (0.9557, 4) → « 0,9557 ».
 */
export const formatDecimal = (value: number, decimals = 2): string =>
  getFormatter('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
