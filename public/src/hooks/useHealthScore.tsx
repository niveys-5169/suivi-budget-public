import { useMemo } from 'react';
import { useBudget } from './useBudget';
import { useAlerts } from './useAlerts';
import { useWealthAggregates } from './useWealthAggregates';
import { useSpendingTrends } from './useSpendingTrends';
import { computeHealthScore, type HealthScore } from '../utils/computeHealthScore';

/**
 * Calcule le score de santé financière global à partir des données déjà disponibles :
 * taux d'épargne RAV, respect des budgets, diversification patrimoniale, tendance des dépenses.
 */
export const useHealthScore = (): HealthScore => {
  const { budgets } = useBudget();
  const { errorCount } = useAlerts();
  const { segments } = useWealthAggregates('all');
  const { breakdown } = useSpendingTrends(3);

  return useMemo(() => {
    const activeBudgets = budgets.filter(
      (b) => b.actif !== false && (b.montant ?? 0) > 0 && b.type !== 'revenu',
    );

    // Tendance globale des dépenses : variation du total mois n-1 vs mois n-2.
    let spendingDeltaPct: number | null = null;
    if (breakdown.length >= 2) {
      const prev = breakdown[breakdown.length - 2]?.total ?? 0;
      const curr = breakdown[breakdown.length - 1]?.total ?? 0;
      if (prev > 0) spendingDeltaPct = ((curr - prev) / prev) * 100;
    }

    // Le taux d'épargne est calculé directement depuis les segments patrimoniaux.
    // On n'a pas accès au RAV sans les transactions + config ici ; on utilise null
    // pour que le sous-score soit exclu et que les poids se renormalisent.
    // Si tu veux brancher le calcul RAV complet ici, tu peux l'importer depuis
    // computeRav une fois que la logique est extraite de RAVEditor.
    const savingsRate: number | null = null;

    return computeHealthScore({
      savingsRate,
      budgetErrorCount: errorCount,
      budgetTotalCount: activeBudgets.length,
      segments,
      spendingDeltaPct,
    });
  }, [budgets, errorCount, segments, breakdown]);
};
