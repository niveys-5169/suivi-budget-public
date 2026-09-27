import type { BudgetBase } from '../types/banking.types';
import { categoryKey } from './budgetHelpers';
import { getAssignedMonthKey } from './date';

/**
 * Enveloppes annuelles — budgets `type: 'annuel'` de dépense (vacances d'été,
 * taxe foncière…) suivis sur un cycle de 12 mois qui se termine au mois de
 * l'événement, au lieu d'être découpés en 1/12 par mois.
 *
 * Le mois de l'événement est le dernier de `moisAttendus` ; décembre par défaut
 * (cycle = année civile, comportement historique des budgets annuels).
 */

export interface EnvelopeTransaction {
  categorie?: string;
  montant?: number;
  date?: string;
  moisAffectation?: string;
}

export interface AnnualEnvelope {
  categorie: string;
  montant: number;
  /** Net dépensé sur le cycle (dépenses − remboursements). */
  depense: number;
  reste: number;
  /** Mois de l'événement, fin du cycle (YYYY-MM). */
  echeanceKey: string;
  moisEcheance: number;
  /** Somme à mettre de côté chaque mois. */
  provisionMensuelle: number;
}

const INTERNAL_TRANSFER = 'Virement interne';

const monthKeyOf = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`;

export const isEnvelope = (b: BudgetBase): boolean =>
  b.actif !== false && b.type === 'annuel' && b.isIncome !== true;

export const getEcheanceMonth = (b: Pick<BudgetBase, 'moisAttendus'>): number =>
  b.moisAttendus && b.moisAttendus.length > 0 ? Math.max(...b.moisAttendus) : 12;

/** Bornes (incluses, YYYY-MM) du cycle de 12 mois contenant `monthKey`. */
export function getEnvelopeCycle(
  moisEcheance: number,
  monthKey: string,
): { debut: string; fin: string } {
  const [year = NaN, month = NaN] = monthKey.split('-').map(Number);
  const finYear = month <= moisEcheance ? year : year + 1;
  const debutMonth = (moisEcheance % 12) + 1;
  const debutYear = debutMonth === 1 ? finYear : finYear - 1;
  return { debut: monthKeyOf(debutYear, debutMonth), fin: monthKeyOf(finYear, moisEcheance) };
}

export function computeEnvelope(
  budget: BudgetBase,
  transactions: EnvelopeTransaction[],
  monthKey: string,
): AnnualEnvelope {
  const moisEcheance = getEcheanceMonth(budget);
  const { debut, fin } = getEnvelopeCycle(moisEcheance, monthKey);
  const key = categoryKey(budget.categorie);

  const net = transactions.reduce((sum, t) => {
    if (t.categorie === INTERNAL_TRANSFER || categoryKey(t.categorie) !== key) return sum;
    const m = getAssignedMonthKey(t);
    return m >= debut && m <= fin ? sum + (Number(t.montant) || 0) : sum;
  }, 0);

  const montant = Number(budget.montant) || 0;
  const depense = -net || 0;
  return {
    categorie: budget.categorie,
    montant,
    depense,
    reste: montant - depense,
    echeanceKey: fin,
    moisEcheance,
    provisionMensuelle: montant / 12,
  };
}
