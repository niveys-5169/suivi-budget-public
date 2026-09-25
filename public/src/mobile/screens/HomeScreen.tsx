import React, { useMemo, useState } from 'react';
import { FormattedNumber } from 'react-intl';
import { Eye, EyeOff, Plus, ChevronRight, Settings, Sparkles, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useBalances } from '../../hooks/useBalances';
import { useTransactions } from '../../hooks/useTransactions';
import { useFormOptions } from '../../hooks/useFormOptions';
import type { Transaction } from '../../types/banking.types';
import { needsBalanceReview } from '../../utils/balanceMapping';

import { MScreenHeader } from '../components/MScreenHeader';
import { MSettingsModal } from '../components/MSettingsModal';
import { TransactionFormModal } from '../../components/TransactionFormModal';

import { AurumUnpointedCard } from '../../components/dashboard/v2/AurumUnpointedCard';
import { AurumPointageModal } from '../../components/dashboard/v2/AurumPointageModal';
import { AurumCashflowCard } from '../../components/dashboard/v2/AurumCashflowCard';

export const HomeScreen: React.FC = () => {
  const navigate = useNavigate();
  const { checkingBalances = [], checkingTotal = 0 } = useBalances();
  const { transactions, saveTransaction, deleteTransaction, updateFilters, togglePointe } =
    useTransactions();
  const { categories, accounts } = useFormOptions();

  const [showBalance, setShowBalance] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pointageOpen, setPointageOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  const unpointedTxs = useMemo(() => transactions.filter((t) => !t.pointe), [transactions]);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <MScreenHeader
        title="Tableau de bord"
        rightAction={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="w-11 h-11 flex items-center justify-center text-label-secondary active:text-white"
            >
              {showBalance ? <Eye size={22} /> : <EyeOff size={22} />}
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-11 h-11 flex items-center justify-center text-label-secondary active:text-white"
            >
              <Settings size={22} />
            </button>
          </div>
        }
      />

      {/* Hero Balance Section */}
      <section className="px-4 py-4 flex flex-col items-center justify-center text-center">
        <span className="text-caption font-bold text-label-tertiary mb-1">Comptes Courants</span>
        <div className="flex items-baseline gap-2">
          <h2 className="text-display font-bold tracking-tight text-white flex items-center">
            {showBalance ? (
              <FormattedNumber value={checkingTotal} style="currency" currency="EUR" />
            ) : (
              '•••••• €'
            )}
          </h2>
        </div>
      </section>

      {/* Accounts Section */}
      <section className="mt-4">
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="text-caption font-bold tracking-normal text-label-tertiary">
            Comptes Courants
          </h3>
        </div>
        <div className="divide-y divide-separator px-4">
          {checkingBalances.map((account) => (
            <div
              key={account.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                updateFilters({ compte: account.compte });
                navigate('/transactions');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}
              className="py-4 flex items-center justify-between text-body text-white active:bg-white/5 cursor-pointer rounded-xl px-2 -mx-2 transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{account.compte}</span>
                {needsBalanceReview(account) && (
                  // Le contrôle de cohérence (ancien solde + mouvements ≠ solde
                  // Linxo) n'était visible que dans BalanceCard, côté desktop.
                  <span className="shrink-0 px-2 py-1 rounded-full text-caption font-semibold text-negative bg-negative/10 border border-negative/20 tabular-nums">
                    {typeof account.ecart === 'number' ? (
                      <>
                        Écart{' '}
                        <FormattedNumber
                          value={account.ecart}
                          style="currency"
                          currency="EUR"
                          signDisplay="always"
                        />
                      </>
                    ) : (
                      'À réviser'
                    )}
                  </span>
                )}
              </span>
              <span className="font-semibold tabular-nums">
                {showBalance ? (
                  <FormattedNumber
                    value={account.current_balance || account.solde || 0}
                    style="currency"
                    currency="EUR"
                  />
                ) : (
                  '•••• €'
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* The 2 blocks */}
      <div className="px-4 py-4 space-y-6 pb-20">
        <AurumUnpointedCard count={unpointedTxs.length} onClick={() => setPointageOpen(true)} />
        <AurumCashflowCard />
        <button
          onClick={() => navigate('/qa')}
          className="w-full text-left rounded-xl p-6 bg-surface border border-separator flex items-center justify-between hover:bg-white/[0.05] hover:border-separator transition-all duration-300 group cursor-pointer"
          aria-label="Ouvrir l'assistant IA"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles size={22} className="text-gold" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Assistant IA</p>
              <p className="text-caption text-white/40 font-bold mt-1">
                Analyse tes finances en langage naturel
              </p>
            </div>
          </div>
          <ChevronRight
            size={18}
            className="text-white/30 group-hover:text-white/60 transition-colors"
          />
        </button>
        <button
          onClick={() => navigate('/recurring')}
          className="w-full text-left rounded-xl p-6 bg-surface border border-separator flex items-center justify-between hover:bg-white/[0.05] hover:border-separator transition-all duration-300 group cursor-pointer"
          aria-label="Ouvrir mes récurrences"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <RefreshCw size={22} className="text-gold" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Récurrences</p>
              <p className="text-caption text-white/40 font-bold mt-1">
                Consulter, approuver et lier tes charges fixes
              </p>
            </div>
          </div>
          <ChevronRight
            size={18}
            className="text-white/30 group-hover:text-white/60 transition-colors"
          />
        </button>
      </div>

      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          bottom: 'calc(56px + 1.5rem + env(safe-area-inset-bottom, 0px))',
        }}
        className="fixed right-4 w-14 h-14 bg-gold text-bg flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform z-40"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      <TransactionFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        transaction={null}
        onSave={saveTransaction}
        onDelete={deleteTransaction}
        categories={categories as string[]}
        accounts={accounts as string[]}
      />

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
        categories={categories as string[]}
        accounts={accounts as string[]}
      />

      <MSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};
