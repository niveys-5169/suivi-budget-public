import type { ProjectionMonth } from '../../types/banking.types';
import { formatCurrency } from '../../lib/formatters';
import { monthOfYear, yearOf } from '../../utils/projection/projectionMonths';

/** « 2027-03 » -> « mars 2027 » (mois abrégé, année complète). */
export function formatMois(mois: ProjectionMonth): string {
  return new Date(yearOf(mois), monthOfYear(mois) - 1, 1).toLocaleDateString('fr-FR', {
    month: 'short',
    year: 'numeric',
  });
}

/** Montant arrondi à l'euro, pour les tooltips et les valeurs annuelles. */
export function formatEuros(value: number): string {
  return formatCurrency(value, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });
}
