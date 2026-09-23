import React, { useState, useEffect, useMemo } from 'react';
import { AurumAccountsList } from './AurumAccountsList';
import { AurumUnpointedCard } from './AurumUnpointedCard';
import { AurumPointageModal } from './AurumPointageModal';
import { AurumCashflowCard } from './AurumCashflowCard';
import { TransactionFormModal } from '../../TransactionFormModal';

const AurumBudgetPage = React.lazy(() =>
  import('./AurumBudgetPage').then((m) => ({ default: m.AurumBudgetPage })),
);
const AurumTransactionsPage = React.lazy(() =>
  import('./AurumTransactionsPage').then((m) => ({ default: m.AurumTransactionsPage })),
);
const AurumProfilePage = React.lazy(() =>
  import('./AurumProfilePage').then((m) => ({ default: m.AurumProfilePage })),
);
const AurumTransactionDetail = React.lazy(() =>
  import('./AurumTransactionDetail').then((m) => ({ default: m.AurumTransactionDetail })),
);
const AurumAIPage = React.lazy(() =>
  import('./AurumAIPage').then((m) => ({ default: m.AurumAIPage })),
);
const AurumNotificationPage = React.lazy(() =>
  import('./AurumNotificationPage').then((m) => ({ default: m.AurumNotificationPage })),
);
const AurumRulesPage = React.lazy(() =>
  import('./AurumRulesPage').then((m) => ({ default: m.AurumRulesPage })),
);
const AurumRecurringPage = React.lazy(() =>
  import('./AurumRecurringPage').then((m) => ({ default: m.AurumRecurringPage })),
);
const AurumInsightsPage = React.lazy(() =>
  import('./AurumInsightsPage').then((m) => ({ default: m.AurumInsightsPage })),
);
const AurumSettingsPage = React.lazy(() =>
  import('./AurumSettingsPage').then((m) => ({ default: m.AurumSettingsPage })),
);

import { CommandPalette } from './CommandPalette';
import { useAlerts } from '../../../hooks/useAlerts';
import { useBalances } from '../../../hooks/useBalances';
import { useDashboard } from '../../../hooks/useDashboard';
import { useTransactionContext, Transaction } from '../../../context/TransactionContext';
import { useSyncTransactions } from '../../../hooks/useSyncTransactions';
import { PullToRefreshWrapper } from '../../PullToRefreshWrapper';
import { AnimatedBalance } from '../../shared/AnimatedBalance';
import { Button, IconButton, Section, Skeleton, Stack, Text } from '../../../ui';
import { Bell, Search, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';

export const AurumDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  type DashboardTab =
    | 'dashboard'
    | 'flux'
    | 'budget'
    | 'profile'
    | 'ai'
    | 'notifications'
    | 'rules'
    | 'advanced_settings'
    | 'recurring'
    | 'insights';

  const [activeTab, setActiveTab] = useState<DashboardTab>(
    () => (location.state as { tab?: DashboardTab })?.tab || 'dashboard',
  );

  // Une navigation portant `state.tab` (ex. depuis la palette) change d'onglet.
  const [seenLocationState, setSeenLocationState] = useState(location.state);
  if (location.state !== seenLocationState) {
    setSeenLocationState(location.state);
    const tab = (location.state as { tab?: DashboardTab } | null)?.tab;
    if (tab) setActiveTab(tab);
  }
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const {
    balances = [],
    checkingBalances = [],
    checkingTotal = 0,
    loading: balLoading,
  } = useBalances() || {};
  const { allCategories = [], loading: dashLoading } = useDashboard() || {};
  const {
    transactions = [],
    loading: txLoading,
    saveTransaction,
    deleteTransaction,
    togglePointe,
    updateFilters,
  } = useTransactionContext() || {};

  const [pointageOpen, setPointageOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const unpointedTxs = useMemo(() => transactions.filter((t) => !t.pointe), [transactions]);

  const accountNames = useMemo(() => {
    if (!balances || !Array.isArray(balances)) return [];
    return Array.from(new Set(balances.map((b) => b.compte)))
      .filter(Boolean)
      .sort();
  }, [balances]);
  const { sync, isSyncing } = useSyncTransactions();
  const { errorCount } = useAlerts();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAccountClick = (name: string) => {
    if (updateFilters) {
      updateFilters({ compte: name });
    }
    navigate('/transactions');
  };

  const isLoading = balLoading || dashLoading || txLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col gap-8 bg-bg px-4 pt-safe-lg md:px-6">
        <Stack gap="sm">
          <Skeleton tone="accent" className="h-4 w-40" />
          <Skeleton tone="accent" className="h-10 w-56" />
        </Stack>
        <Stack gap="md">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </Stack>
        <Stack direction="row" gap="md" justify="center" role="status" aria-live="polite">
          {[
            { label: 'Soldes', loading: balLoading },
            { label: 'Statistiques', loading: dashLoading },
            { label: 'Flux', loading: txLoading },
          ].map((s) => (
            <Text
              key={s.label}
              variant="caption"
              tone={s.loading ? 'tertiary' : 'positive'}
              className={s.loading ? 'animate-pulse' : ''}
            >
              {s.label}
            </Text>
          ))}
        </Stack>
      </div>
    );
  }

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  const renderContent = () => {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="min-h-screen"
        >
          <React.Suspense
            fallback={
              <div className="flex min-h-screen items-center justify-center bg-bg">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold/20 border-t-gold" />
              </div>
            }
          >
            {(() => {
              switch (activeTab) {
                case 'budget':
                  return <AurumBudgetPage />;
                case 'flux':
                  return <AurumTransactionsPage />;
                case 'profile':
                  return (
                    <AurumProfilePage
                      onNavigate={(tab: string) => setActiveTab(tab as DashboardTab)}
                    />
                  );
                case 'ai':
                  return <AurumAIPage />;
                case 'rules':
                  return <AurumRulesPage onBack={() => setActiveTab('profile')} />;
                case 'advanced_settings':
                  return (
                    <AurumSettingsPage
                      onBack={() => setActiveTab('profile')}
                      initialSection={
                        (
                          location.state as {
                            section?: 'api' | 'energy' | 'treasury' | 'attribution';
                          }
                        )?.section ?? 'api'
                      }
                    />
                  );
                case 'notifications':
                  return (
                    <AurumNotificationPage
                      onBack={() => setActiveTab('dashboard')}
                      onNavigate={(tab: string) => setActiveTab(tab as DashboardTab)}
                    />
                  );
                case 'recurring':
                  return <AurumRecurringPage onBack={() => setActiveTab('profile')} />;
                case 'insights':
                  return <AurumInsightsPage />;
                default:
                  return (
                    <PullToRefreshWrapper onRefresh={sync} disabled={isSyncing}>
                      <div className="min-h-screen overflow-x-hidden bg-bg selection:bg-gold/30">
                        <nav className="flex items-start justify-between gap-4 px-4 pt-safe-lg pb-6 md:px-6">
                          <div className="min-w-0">
                            <Text variant="caption" tone="tertiary">
                              Comptes courants
                            </Text>
                            <Text
                              as="h1"
                              variant="display"
                              tone="accent"
                              numeric
                              className="font-serif"
                            >
                              <AnimatedBalance value={checkingTotal} />
                            </Text>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <IconButton
                              label="Synchroniser"
                              variant="plain"
                              onClick={sync}
                              disabled={isSyncing}
                              className={isSyncing ? 'text-positive' : ''}
                            >
                              <RefreshCw size={20} className={isSyncing ? 'animate-spin' : ''} />
                            </IconButton>
                            <IconButton
                              label="Rechercher"
                              variant="plain"
                              onClick={() => setPaletteOpen(true)}
                            >
                              <Search size={20} />
                            </IconButton>
                            <IconButton
                              label="Assistant"
                              variant="plain"
                              onClick={() => setActiveTab('ai')}
                            >
                              <Sparkles size={20} />
                            </IconButton>
                            <IconButton
                              label={
                                errorCount > 0
                                  ? `Notifications, ${errorCount} alerte${errorCount > 1 ? 's' : ''}`
                                  : 'Notifications'
                              }
                              variant="plain"
                              onClick={() => setActiveTab('notifications')}
                              className="relative"
                            >
                              <Bell size={20} />
                              {errorCount > 0 && (
                                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-negative" />
                              )}
                            </IconButton>
                          </div>
                        </nav>
                        <main className="flex flex-col gap-8 px-4 pb-nav-safe md:px-6">
                          <Section
                            title="Comptes courants"
                            action={
                              <Button
                                variant="plain"
                                size="sm"
                                onClick={() => navigate('/patrimoine')}
                              >
                                Tout voir
                              </Button>
                            }
                          >
                            <AurumAccountsList
                              onAccountClick={handleAccountClick}
                              accounts={
                                Array.isArray(checkingBalances)
                                  ? checkingBalances.map((b) => ({
                                      id: b.id,
                                      name: b.compte,
                                      balance: b.current_balance ?? b.solde ?? 0,
                                      status: b.status,
                                      owner: b.owner,
                                      source: b.source,
                                      syncedAt: b.source_timestamp ?? b.lastUpdated,
                                    }))
                                  : []
                              }
                            />
                          </Section>
                          <AurumUnpointedCard
                            count={unpointedTxs.length}
                            onClick={() => setPointageOpen(true)}
                          />
                          <AurumCashflowCard />
                        </main>
                      </div>
                    </PullToRefreshWrapper>
                  );
              }
            })()}
          </React.Suspense>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <>
      {renderContent()}
      <AnimatePresence>
        {selectedTx && (
          <React.Suspense fallback={null}>
            <AurumTransactionDetail
              transaction={selectedTx}
              onClose={() => setSelectedTx(null)}
              onSave={saveTransaction}
              onDelete={deleteTransaction}
            />
          </React.Suspense>
        )}
        <AurumPointageModal
          isOpen={pointageOpen}
          onClose={() => setPointageOpen(false)}
          transactions={unpointedTxs}
          onTogglePointe={togglePointe}
          onEdit={(tx) => {
            setEditingTx(tx);
            setPointageOpen(false);
          }}
        />
        <TransactionFormModal
          isOpen={!!editingTx}
          onClose={() => {
            setEditingTx(null);
            setPointageOpen(true);
          }}
          onSave={saveTransaction}
          onDelete={deleteTransaction}
          transaction={editingTx}
          categories={allCategories}
          accounts={accountNames}
        />
      </AnimatePresence>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(tab) => {
          setPaletteOpen(false);
          // La vue patrimoine canonique vit sur sa propre route (WealthPage),
          // pas dans un onglet du dashboard.
          if (tab === 'wealth') {
            navigate('/patrimoine');
            return;
          }
          setActiveTab(tab as DashboardTab);
        }}
      />
    </>
  );
};
