import React, { useMemo, useState } from 'react';
import { FormattedNumber } from 'react-intl';
import { Eye, EyeOff, Plus, ChevronRight, Settings, Sparkles, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useBalances } from '../../hooks/useBalances';
import { useTransactions } from '../../hooks/useTransactions';
import { useFormOptions } from '../../hooks/useFormOptions';
import type { Transaction } from '../../types/banking.types';
import { mouvementsDepuisSolde, needsBalanceReview } from '../../utils/balanceMapping';

import { MSettingsModal } from '../components/MSettingsModal';
import { TransactionFormModal } from '../../components/TransactionFormModal';

import { AurumUnpointedCard } from '../../components/dashboard/v2/AurumUnpointedCard';
import { AurumPointageModal } from '../../components/dashboard/v2/AurumPointageModal';
import { AurumCashflowCard } from '../../components/dashboard/v2/AurumCashflowCard';
import { SafeToSpendPill } from '../../components/shared/SafeToSpendPill';
import { BankBalanceStatus } from '../../components/banking/BankBalanceStatus';
import { FLAGS } from '../../lib/featureFlags';
import { Button, IconButton, Text } from '../../ui';

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
  // Opérations arrivées après le mail du solde : le solde affiché n'est pas à jour.
  const mouvementsParCompte = useMemo(
    () => new Map(checkingBalances.map((b) => [b.id, mouvementsDepuisSolde(b, transactions)])),
    [checkingBalances, transactions],
  );

  const recentTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 4);
  }, [transactions]);

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-20">
      {/* Luxury AURUM Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full border border-gold/40 bg-gold/10 flex items-center justify-center text-gold font-serif text-xs font-bold shrink-0">
            Au
          </div>
          <span className="font-serif font-bold text-base text-gold tracking-widest">AURUM</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            variant="plain"
            size="sm"
            label={showBalance ? 'Masquer le solde' : 'Afficher le solde'}
            onClick={() => setShowBalance(!showBalance)}
          >
            {showBalance ? <Eye size={18} /> : <EyeOff size={18} />}
          </IconButton>
          <IconButton
            variant="plain"
            size="sm"
            label="Paramètres"
            onClick={() => setIsSettingsOpen(true)}
          >
            <Settings size={18} />
          </IconButton>
        </div>
      </header>

      {/* Hero Balance Card */}
      <section className="px-4 pt-2 pb-4">
        <div className="rounded-xl p-6 bg-surface border border-separator shadow-lg relative overflow-hidden">
          <div
            className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-gold/5 blur-2xl pointer-events-none"
            aria-hidden="true"
          />
          <div className="flex items-center justify-between mb-2">
            <span className="text-caption font-bold text-label-tertiary">Comptes Courants</span>
            <span className="px-2 py-1 rounded-full text-caption font-mono font-bold bg-gold/10 border border-gold/30 text-gold">
              EUR
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-2">
            <h2 className="text-display font-serif font-bold tracking-tight text-label flex items-center tabular-nums">
              {showBalance ? (
                <FormattedNumber value={checkingTotal} style="currency" currency="EUR" />
              ) : (
                '•••••• €'
              )}
            </h2>
          </div>
          {FLAGS.SAFE_TO_SPEND && showBalance && (
            <div className="pt-2 border-t border-separator/60">
              <SafeToSpendPill compact />
            </div>
          )}
        </div>
      </section>

      {/* Gold Trend Wave Chart Card */}
      <section className="px-4 py-2">
        <div className="rounded-xl p-4 bg-surface border border-separator relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <div>
              <Text variant="caption" tone="tertiary">
                Tendance mensuelle
              </Text>
              <Text variant="headline" className="text-label">
                Performance & Liquidités
              </Text>
            </div>
            <span className="px-2 py-1 rounded-full text-caption font-medium bg-gold/10 text-gold border border-gold/20">
              30 derniers jours
            </span>
          </div>

          <div className="relative py-2">
            <svg
              className="w-full h-24 overflow-visible"
              viewBox="0 0 320 80"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="aurumGoldArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-gold)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-gold)" stopOpacity="0.0" />
                </linearGradient>
                <filter id="aurumGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <path
                d="M 0 65 C 45 60, 85 28, 140 38 C 190 48, 235 18, 275 22 C 295 24, 310 14, 320 12 L 320 80 L 0 80 Z"
                fill="url(#aurumGoldArea)"
              />
              <path
                d="M 0 65 C 45 60, 85 28, 140 38 C 190 48, 235 18, 275 22 C 295 24, 310 14, 320 12"
                fill="none"
                stroke="var(--color-gold)"
                strokeWidth="2.5"
                filter="url(#aurumGlow)"
              />
              <circle cx="275" cy="22" r="4" fill="var(--color-gold)" />
              <circle
                cx="275"
                cy="22"
                r="8"
                fill="none"
                stroke="var(--color-gold)"
                strokeOpacity="0.4"
              />
            </svg>
            <div className="absolute top-2 right-8 px-2 py-1 rounded-md bg-gold/20 border border-gold/40 backdrop-blur-md text-caption font-mono font-bold text-gold shadow-sm">
              Tendance positive
            </div>
          </div>

          <div className="flex items-center justify-center gap-1 pt-2">
            <div className="w-4 h-1.5 rounded-full bg-gold" />
            <div className="w-1.5 h-1.5 rounded-full bg-separator" />
            <div className="w-1.5 h-1.5 rounded-full bg-separator" />
          </div>
        </div>
      </section>

      {/* Recent Activity Section */}
      <section className="px-4 py-2">
        <div className="flex items-center justify-between py-2">
          <span className="text-caption font-serif font-bold tracking-wider text-gold">
            ACTIVITÉ RÉCENTE
          </span>
          <Button
            variant="plain"
            size="sm"
            onClick={() => navigate('/transactions')}
            className="text-caption font-medium text-gold hover:underline !px-0 !min-h-0"
          >
            Voir tout
          </Button>
        </div>
        <div className="rounded-xl bg-surface border border-separator divide-y divide-separator overflow-hidden">
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx, idx) => (
              <div
                key={tx.id || `${tx.compte}-${tx.date}-${idx}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setEditingTx(tx);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setEditingTx(tx);
                  }
                }}
                className="p-4 flex items-center justify-between gap-2 active:bg-raised/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center text-gold font-serif font-bold text-caption shrink-0">
                    {tx.libelle ? tx.libelle.charAt(0).toUpperCase() : '€'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-body font-medium text-label truncate">
                      {tx.libelle || 'Transaction'}
                    </p>
                    <p className="text-caption text-label-tertiary">
                      {tx.categorie || 'Général'}
                      {tx.date
                        ? ` • ${new Date(tx.date).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'short',
                          })}`
                        : ''}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-serif font-bold tabular-nums text-body shrink-0 ${
                    (tx.montant ?? 0) < 0 ? 'text-negative' : 'text-positive'
                  }`}
                >
                  <FormattedNumber value={tx.montant ?? 0} style="currency" currency="EUR" />
                </span>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-caption text-label-tertiary">
              Aucune opération récente
            </div>
          )}
        </div>
      </section>

      {/* Accounts Section */}
      <section className="px-4 py-2">
        <div className="flex items-center justify-between py-2">
          <h3 className="text-caption font-bold tracking-normal text-label-tertiary">
            Comptes Courants
          </h3>
        </div>
        <div className="rounded-xl bg-surface border border-separator divide-y divide-separator overflow-hidden px-4">
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
              className="py-4 flex flex-wrap gap-2 items-center justify-between text-body text-label active:bg-raised/40 cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{account.compte}</span>
                {(mouvementsParCompte.get(account.id)?.count ?? 0) > 0 ? (
                  <span className="shrink-0 px-2 py-1 rounded-full text-caption font-semibold text-negative bg-negative/10 border border-negative/20 tabular-nums">
                    Non à jour{' '}
                    <FormattedNumber
                      value={mouvementsParCompte.get(account.id)?.total ?? 0}
                      style="currency"
                      currency="EUR"
                      signDisplay="always"
                    />
                  </span>
                ) : (
                  needsBalanceReview(account) && (
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
                  )
                )}
              </span>
              <span className="font-semibold tabular-nums text-label">
                {showBalance ? (
                  <FormattedNumber
                    value={account.current_balance ?? account.solde ?? 0}
                    style="currency"
                    currency="EUR"
                  />
                ) : (
                  '•••• €'
                )}
              </span>
              <div className="w-full">
                <BankBalanceStatus balance={account} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Auxiliary Cards & Shortcuts */}
      <div className="px-4 py-4 space-y-4">
        <AurumUnpointedCard count={unpointedTxs.length} onClick={() => setPointageOpen(true)} />
        <AurumCashflowCard />
        <button
          onClick={() => navigate('/qa')}
          className="w-full text-left rounded-xl p-6 bg-surface border border-separator flex items-center justify-between hover:bg-raised/30 transition-all duration-300 group cursor-pointer"
          aria-label="Ouvrir l'assistant IA"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Sparkles size={22} className="text-gold" />
            </div>
            <div>
              <p className="text-sm font-bold text-label">Assistant IA</p>
              <p className="text-caption text-label-tertiary font-bold mt-1">
                Analyse tes finances en langage naturel
              </p>
            </div>
          </div>
          <ChevronRight
            size={18}
            className="text-label-tertiary group-hover:text-label-secondary transition-colors"
          />
        </button>
        <button
          onClick={() => navigate('/recurring')}
          className="w-full text-left rounded-xl p-6 bg-surface border border-separator flex items-center justify-between hover:bg-raised/30 transition-all duration-300 group cursor-pointer"
          aria-label="Ouvrir mes récurrences"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center group-hover:scale-105 transition-transform">
              <RefreshCw size={22} className="text-gold" />
            </div>
            <div>
              <p className="text-sm font-bold text-label">Récurrences</p>
              <p className="text-caption text-label-tertiary font-bold mt-1">
                Consulter, approuver et lier tes charges fixes
              </p>
            </div>
          </div>
          <ChevronRight
            size={18}
            className="text-label-tertiary group-hover:text-label-secondary transition-colors"
          />
        </button>
      </div>

      {/* Floating Add Transaction Button */}
      <button
        onClick={() => setIsModalOpen(true)}
        style={{
          bottom: 'calc(56px + 1.5rem + env(safe-area-inset-bottom, 0px))',
        }}
        className="fixed right-4 w-14 h-14 bg-gold text-bg flex items-center justify-center rounded-full shadow-lg active:scale-95 transition-transform z-40"
        aria-label="Ajouter une transaction"
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
