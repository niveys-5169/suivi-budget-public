import React, { useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useBudget } from '../../hooks/useBudget';
import { useTransactions } from '../../hooks/useTransactions';
import { BudgetsPage } from './BudgetsPage';
import { BankinBudgetsContainer } from './bankin/BankinBudgetsContainer';
import { FLAGS } from '../../lib/featureFlags';
import { hideLoader } from '../../utils/loader';

export const BudgetsV2Section: React.FC = () => {
  const { formatMessage: t } = useIntl();
  const { loading: budgetLoading } = useBudget();
  const { loading: txLoading, requestFullLoad } = useTransactions();

  useEffect(() => {
    if (!budgetLoading && !txLoading) hideLoader();
  }, [budgetLoading, txLoading]);

  // Request full load for annual/long term budgets
  useEffect(() => {
    requestFullLoad();
  }, [requestFullLoad]);

  if (budgetLoading || txLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-gold/10 border-t-gold rounded-full animate-spin" />
        <p className="text-caption font-semibold text-gold animate-pulse">
          {t({ id: 'state.loading.budget' })}
        </p>
      </div>
    );
  }

  if (FLAGS.BUDGET_BANKIN) {
    return <BankinBudgetsContainer />;
  }

  return <BudgetsPage />;
};
