import { useMemo } from 'react';
import { useGlobalData } from '../context/GlobalDataContext';
import { useAnnualEnvelopes } from './useAnnualEnvelopes';
import { computeDerivedRav, toRavFormConfig } from '../utils/ravCalculations';
import type { Transaction } from '../types/banking.types';

/**
 * Reste-À-Vivre du mois avec la config enregistrée — même calcul que le bandeau
 * du RAVEditor, pour que l'en-tête Budgets affiche le même solde prévu.
 */
export const useRavSummary = (monthKey: string, transactions: Transaction[]) => {
  const { ravConfig, recurrences } = useGlobalData();
  const { envelopeKeys, totalProvisionMensuelle } = useAnnualEnvelopes(transactions, monthKey);

  return useMemo(
    () =>
      computeDerivedRav(toRavFormConfig(ravConfig), {
        monthKey,
        txList: transactions,
        recurrences: recurrences.filter((r) => r.active),
        envelopeKeys,
        envelopeProvision: totalProvisionMensuelle,
      }),
    [ravConfig, recurrences, monthKey, transactions, envelopeKeys, totalProvisionMensuelle],
  );
};
