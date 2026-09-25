import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { useBalances } from '../hooks/useBalances';
import { useTransactions } from '../hooks/useTransactions';
import { mouvementsDepuisSolde } from '../utils/balanceMapping';
import { BalanceCard } from './BalanceCard';
import { ReconciliationModal } from './ReconciliationModal';
import { BalanceHistoryModal } from './BalanceHistoryModal';
import { AccountBalance } from '../types/balances';
import { Skeleton } from './shared/Skeleton';

export const BalancesPanel: React.FC = () => {
  const { formatMessage: t } = useIntl();
  const { balances, loading, error } = useBalances();
  const { transactions } = useTransactions();
  const [selectedAccount, setSelectedAccount] = useState<AccountBalance | null>(null);
  const [historyAccount, setHistoryAccount] = useState<AccountBalance | null>(null);

  if (loading) {
    return (
      <div className="balances-grid">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="balance-detail text-negative">
        {t({ id: 'balances.error' })}
      </div>
    );
  }

  if (balances.length === 0) {
    return <div className="balance-detail">{t({ id: 'balances.empty' })}</div>;
  }

  const sortedBalances = [...balances].sort((a, b) =>
    String(a.compte || a.id).localeCompare(String(b.compte || b.id), 'fr'),
  );

  return (
    <>
      <div className="balances-grid">
        {sortedBalances.map((balance) => (
          <BalanceCard
            key={balance.id}
            balance={balance}
            mouvementsDepuis={mouvementsDepuisSolde(balance, transactions)}
            onClick={() => setSelectedAccount(balance)}
            onHistoryClick={() => setHistoryAccount(balance)}
          />
        ))}
      </div>
      <ReconciliationModal
        isOpen={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
        account={selectedAccount}
      />
      <BalanceHistoryModal
        isOpen={!!historyAccount}
        onClose={() => setHistoryAccount(null)}
        account={historyAccount}
        onOpenReconciliation={() => {
          setSelectedAccount(historyAccount);
          setHistoryAccount(null);
        }}
      />
    </>
  );
};
