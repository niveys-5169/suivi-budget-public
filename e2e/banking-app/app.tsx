import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { BankingDataContext } from '../../public/src/hooks/useBankingData';
import { GlobalDataContext } from '../../public/src/context/GlobalDataContext';
import { TransactionContext } from '../../public/src/context/TransactionContext';
import { BankConnectionsPage } from '../../public/src/components/banking/BankConnectionsPage';
import { BankTransactionBadge } from '../../public/src/components/banking/BankTransactionBadge';
import { BankingBanner } from '../../public/src/components/banking/BankingBanner';
import { AurumNotificationPage } from '../../public/src/components/dashboard/v2/AurumNotificationPage';
import { PullToRefreshWrapper } from '../../public/src/components/PullToRefreshWrapper';
import { useSyncTransactions } from '../../public/src/hooks/useSyncTransactions';
import { Toast } from '../../public/src/components/Toast';
import messages from '../../public/src/i18n/messages/fr';
import '../../public/src/tailwind.css';
import { fixture, events } from './mock-banking-api';

const noop = async () => {};
const fixtureNow = Date.now();
function App() {
  const [, refresh] = useState(0);
  const { sync, isSyncing } = useSyncTransactions();
  useEffect(() => {
    const update = () => refresh((n) => n + 1);
    events.addEventListener('change', update);
    return () => events.removeEventListener('change', update);
  }, []);
  return (
    <GlobalDataContext.Provider
      value={{
        accountBalances: [
          {
            id: 'LCL',
            compte: 'LCL',
            current_balance: 100,
            source: 'gmail',
            status: 'reconciled',
            source_timestamp: null,
          },
        ],
        recurrences: [],
        ravConfig: null,
        loading: false,
        ownerMapping: { accounts: {}, owners: [], default_owner: '', savings_patterns: {} },
      }}
    >
      <TransactionContext.Provider
        value={{
          transactions: [],
          filteredTransactions: [],
          loading: false,
          loadingMore: false,
          hasMore: false,
          loadMore: noop,
          error: null,
          filters: {
            search: '',
            compte: '',
            type: '',
            year: '2026',
            month: '10',
            pointe: '',
            categorie: '',
          },
          updateFilters: () => {},
          resetFilters: () => {},
          togglePointe: noop,
          deleteTransaction: noop,
          saveTransaction: noop,
          pointAll: noop,
          unpointAll: noop,
          bulkUpdate: noop,
          bulkDelete: noop,
          bulkSetPointe: noop,
          requestFullLoad: () => {},
        }}
      >
        <BankingDataContext.Provider
          value={{
            connections: fixture.connections,
            reports: fixture.reports,
            now: fixtureNow,
            loading: false,
            error: null,
          }}
        >
          <div data-testid="pull-surface">
            <PullToRefreshWrapper onRefresh={sync} disabled={isSyncing}>
              <BankingBanner />
              <div data-testid="operation">
                <BankTransactionBadge transaction={{ linxoStatus: fixture.status }} />
              </div>
              <output aria-label="Nombre de synchronisations">{fixture.runs}</output>
              <Routes>
                <Route
                  path="/notifications"
                  element={<AurumNotificationPage onBack={() => history.back()} />}
                />
                <Route path="*" element={<BankConnectionsPage />} />
              </Routes>
            </PullToRefreshWrapper>
          </div>
          <Toast />
        </BankingDataContext.Provider>
      </TransactionContext.Provider>
    </GlobalDataContext.Provider>
  );
}
createRoot(document.getElementById('root')!).render(
  <IntlProvider locale="fr" messages={messages}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </IntlProvider>,
);
