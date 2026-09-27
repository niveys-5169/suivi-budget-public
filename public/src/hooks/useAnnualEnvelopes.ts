import { useMemo } from 'react';
import { useBudget } from './useBudget';
import { categoryKey } from '../utils/budgetHelpers';
import {
  computeEnvelope,
  isEnvelope,
  type AnnualEnvelope,
  type EnvelopeTransaction,
} from '../utils/annualEnvelope';

/**
 * Enveloppes annuelles du cycle contenant le mois affiché, partagées par
 * l'écran Budgets desktop et mobile. `envelopeKeys` (clés `categoryKey`) permet
 * aux écrans de sortir ces catégories des jauges mensuelles.
 */
export const useAnnualEnvelopes = (transactions: EnvelopeTransaction[]) => {
  const { baseBudgets, monthKey } = useBudget();

  return useMemo(() => {
    const envelopes: AnnualEnvelope[] = baseBudgets
      .filter(isEnvelope)
      .map((b) => computeEnvelope(b, transactions, monthKey))
      .sort((a, b) => a.echeanceKey.localeCompare(b.echeanceKey));
    const envelopeKeys = new Set(envelopes.map((e) => categoryKey(e.categorie)));
    return { envelopes, envelopeKeys };
  }, [baseBudgets, transactions, monthKey]);
};
