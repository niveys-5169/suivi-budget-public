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
import { computeMoisReleves, mergeMoisReels } from '../utils/projection/moisReels';

/**
 * Projection long terme : paramètres persistés + données de l'app (transactions des 12 derniers
 * mois, crédits, patrimoine) -> valeurs observées -> entrées du moteur -> simulation -> rapport.
 * Les mois révolus de l'horizon reprennent les montants relevés (ou saisis) au lieu des théoriques.
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

  // Le contexte expose des lignes déjà ventilées : on revient aux transactions stockées.
  const stored = useMemo(() => toStoredTransactions(tx.transactions), [tx.transactions]);
  const ctx = useMemo(
    () => ({
      revenuCategories: ravConfig?.revenu_categories ?? [],
      creditCategories: [],
      excludedCategories: excluded,
    }),
    [ravConfig, excluded],
  );

  const observed = useMemo(
    () =>
      computeObservedValues({
        transactions: stored,
        credits,
        classes: params.classesCategories,
        ctx,
        patrimoineHorsPer,
      }),
    [stored, credits, params.classesCategories, ctx, patrimoineHorsPer],
  );

  // Mois révolus : montants relevés dans les transactions, qui remplacent les théoriques.
  const releves = useMemo(
    () => computeMoisReleves({ transactions: stored, params, ctx, aujourdhui: new Date() }),
    [stored, params, ctx],
  );

  const inputs = useMemo(
    () => ({
      ...resolveProjectionParams(params, observed),
      moisReels: mergeMoisReels(releves, params.moisReels),
    }),
    [params, observed, releves],
  );
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
    releves,
    inputs,
    resultats,
    rapport,
    categories,
    credits,
    loading: paramsLoading || tx.loading || creditsLoading || patrimoineLoading,
    error: paramsError ?? creditsError ?? tx.error?.message ?? null,
  };
}

/** Valeur renvoyée par `useProjection`, transmise aux composants de la section Projections. */
export type UseProjectionResult = ReturnType<typeof useProjection>;
