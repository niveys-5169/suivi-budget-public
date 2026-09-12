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
 * Calcule et formate la variation en pourcentage avec signe.
 */
export const formatPercent = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  // Utilisation de l'espace insécable pour éviter le saut de ligne entre chiffre et %
  return `${sign}${value.toFixed(2)}%`.replace('.', ',');
};
