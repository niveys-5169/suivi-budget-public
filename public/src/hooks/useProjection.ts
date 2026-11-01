import { useMemo } from 'react';
import { useProjectionParams } from './useProjectionParams';
import { useTransactionContext } from '../context/TransactionContext';
import { useCredits } from './useCredits';
import { usePatrimoine } from './usePatrimoine';
import { useGlobalData } from '../context/GlobalDataContext';
import { useBudgetExclusions } from './useBudgetExclusions';
import { computeObservedValues } from '../utils/projection/autoValues';
import { resolveProjectionParams } from '../utils/projection/resolveParams';
import { simulateAll } from '../utils/projection/simulateProjection';
import { buildProjectionReport } from '../utils/projection/projectionReport';
import { computePatrimoineHorsPer } from '../utils/projection/patrimoineHorsPer';
import { toStoredTransactions } from '../utils/projection/storedTransactions';

/**
 * Projection long terme : paramètres persistés + données de l'app (transactions des 12 derniers
 * mois, crédits, patrimoine) -> valeurs observées -> entrées du moteur -> simulation -> rapport.
 */
export function useProjection() {
  const {
    params,
    exists,
    save,
    loading: paramsLoading,
    error: paramsError,
  } = useProjectionParams();
  const tx = useTransactionContext();
  const { credits, loading: creditsLoading, error: creditsError } = useCredits();
  const { totals, loading: patrimoineLoading } = usePatrimoine();
  const { ravConfig } = useGlobalData();
  const { excluded } = useBudgetExclusions();

  // Courants + épargne + bourse, hors PER/retraite et hors immobilier (voir le helper).
  const patrimoineHorsPer = useMemo(
    () => computePatrimoineHorsPer(totals, patrimoineLoading),
    [totals, patrimoineLoading],
  );

  const observed = useMemo(
    () =>
      computeObservedValues({
        // Le contexte expose des lignes déjà ventilées : on revient aux transactions stockées.
        transactions: toStoredTransactions(tx.transactions),
        credits,
        classes: params.classesCategories,
        ctx: {
          revenuCategories: ravConfig?.revenu_categories ?? [],
          creditCategories: [],
          excludedCategories: excluded,
        },
        patrimoineHorsPer,
      }),
    [tx.transactions, credits, params.classesCategories, ravConfig, excluded, patrimoineHorsPer],
  );

  const inputs = useMemo(() => resolveProjectionParams(params, observed), [params, observed]);
  const resultats = useMemo(() => simulateAll(inputs), [inputs]);
  const rapport = useMemo(
    () => buildProjectionReport(inputs, resultats, params.scenarioAfficheId, params.aConfirmer),
    [inputs, resultats, params.scenarioAfficheId, params.aConfirmer],
  );
  const categories = useMemo(
    () => observed.detailCategories.map((d) => d.categorie),
    [observed.detailCategories],
  );

  return {
    params,
    exists,
    save,
    observed,
    inputs,
    resultats,
    rapport,
    categories,
    credits,
    loading: paramsLoading || tx.loading || creditsLoading || patrimoineLoading,
    error: paramsError ?? creditsError ?? tx.error?.message ?? null,
  };
}
