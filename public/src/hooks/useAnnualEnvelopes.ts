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
export const useAnnualEnvelopes = (
  transactions: EnvelopeTransaction[],
  targetMonthKey?: string,
) => {
  const { baseBudgets, monthKey: contextMonthKey } = useBudget();
  const effectiveMonthKey = targetMonthKey || contextMonthKey;

  return useMemo(() => {
    const envelopes: AnnualEnvelope[] = (baseBudgets || [])
      .filter(isEnvelope)
      .map((b) => computeEnvelope(b, transactions, effectiveMonthKey))
      .sort((a, b) => a.echeanceKey.localeCompare(b.echeanceKey));
    const envelopeKeys = new Set(envelopes.map((e) => categoryKey(e.categorie)));
    const totalProvisionMensuelle = envelopes.reduce(
      (acc, e) => acc + (e.provisionMensuelle || 0),
      0,
    );
    return { envelopes, envelopeKeys, totalProvisionMensuelle };
  }, [baseBudgets, transactions, effectiveMonthKey]);
};
