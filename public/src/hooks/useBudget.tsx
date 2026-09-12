import { useBudgetContext } from '../context/BudgetContext';

/** Raccourci vers useBudgetContext — expose les budgets, les overrides annuels et les helpers de calcul. */
export const useBudget = () => {
  return useBudgetContext();
};
