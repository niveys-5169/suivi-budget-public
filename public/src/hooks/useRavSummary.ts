import { useMemo } from 'react';
import { useGlobalData } from '../context/GlobalDataContext';
import { computeDerivedRav, toRavFormConfig } from '../utils/ravCalculations';
import type { Transaction } from '../types/banking.types';

/**
 * Reste-À-Vivre du mois avec la config enregistrée — même calcul que le bandeau
 * du RAVEditor, pour que l'en-tête Budgets affiche le même solde prévu.
 */
export const useRavSummary = (monthKey: string, transactions: Transaction[]) => {
  const { ravConfig, recurrences } = useGlobalData();

  return useMemo(
    () =>
      computeDerivedRav(toRavFormConfig(ravConfig), {
        monthKey,
        txList: transactions,
        recurrences: recurrences.filter((r) => r.active),
      }),
    [ravConfig, recurrences, monthKey, transactions],
  );
};
