import { useState } from 'react';
import { reconcileBanking } from '../services/banking-api';
import { toast } from '../lib/toast';
import type { BankSuggestion } from '../types/banking.types';

/**
 * Suggestions confirmables sans arbitrage : pas de fusion de deux lignes existantes, et
 * chaque observation n'apparaît que dans une seule suggestion (sinon le choix est ambigu).
 */
export const directlyConfirmable = (suggestions: BankSuggestion[]) => {
  const count = (key: 'enableObservationId' | 'linxoObservationId', id: string) =>
    suggestions.filter((item) => item[key] === id).length;
  return suggestions.filter(
    (item) =>
      !item.canonicalRows &&
      count('enableObservationId', item.enableObservationId) === 1 &&
      count('linxoObservationId', item.linxoObservationId) === 1,
  );
};

export function useBankConfirm() {
  const [busy, setBusy] = useState(false);
  const confirmAll = async (suggestions: BankSuggestion[]) => {
    setBusy(true);
    let done = 0;
    try {
      // Séquentiel : chaque appel prend le verrou d'écriture bancaire et recalcule le rapport.
      for (const suggestion of suggestions) {
        await reconcileBanking(suggestion, 'confirm');
        done += 1;
      }
      toast.success(done > 1 ? `${done} rapprochements confirmés.` : 'Rapprochement mis à jour.');
    } catch {
      toast.error(
        `Rapprochement interrompu après ${done}/${suggestions.length}. Vérifiez les opérations restantes dans Vérification Linxo.`,
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, confirmAll };
}
