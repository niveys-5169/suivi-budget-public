import React, { useState } from 'react';
import { fmt } from '../../utils/format';
import { Modal } from '../shared/Modal';
import { BudgetTrendChart } from './BudgetTrendChart';
import { useTransactions } from '../../hooks/useTransactions';
import { BudgetFormModal } from './BudgetFormModal';
import { useAppState } from '../../context/AppStateContext';
import { Edit2, TrendingUp, Calendar, BarChart3, ArrowRight, List, Repeat2 } from 'lucide-react';

import { BudgetBase, BudgetConsumption } from '../../types/banking.types';
import { useRecurrences } from '../../hooks/useRecurrences';

interface BudgetDetailModalProps {
  consumption: BudgetConsumption;
  budget: BudgetBase;
  onClose: () => void;
  onSave?: () => void;
}

export const BudgetDetailModal: React.FC<BudgetDetailModalProps> = ({
  consumption,
  budget,
  onClose,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const { budgetPeriodMode, setBudgetPeriodMode } = useAppState();
  const { nom, depense, montant, reste, statut, ecartRythme, transactionIds } = consumption;
  const { transactions: allTx } = useTransactions();
  const {
    mappings: { linkedTxToRecurrence },
  } = useRecurrences();

  const transactions = allTx
    .filter((t) => transactionIds.includes(t.id))
    .sort((a, b) => b.date.localeCompare(a.date));

  const getStatusColorClass = () => {
    if (statut === 'depasse') return 'text-negative';
    if (statut === 'attention') return 'text-warning';
    return 'text-gold';
  };

  const getTypeColor = () => {
    if (budget.type === 'annuel') return '#8b5cf6';
    if (budget.type === 'ponctuel') return '#ec4899';
    return '#3b82f6';
  };

  // Projection
  const today = new Date();
  const start = new Date(consumption.periodeDebut);
  const end = new Date(consumption.periodeFin);
  const joursPasses = Math.max(
    1,
    Math.round((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const joursTotaux = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const projection = (depense / joursPasses) * joursTotaux;

  if (isEditing) {
    return (
      <BudgetFormModal
        budget={budget}
        onClose={() => setIsEditing(false)}
        onSave={() => {
          setIsEditing(false);
          onSave?.();
        }}
      />
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={nom}
      subtitle={`${budget.categorie} · ${budget.type}`}
      variant="sheet"
      size="lg"
      headerActions={
        <>
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 rounded-xl bg-white/5 border border-separator text-label/40 hover:text-gold hover:bg-gold/10 hover:border-gold/20 transition-all"
            aria-label="Modifier le budget"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => setBudgetPeriodMode('month')}
            className={`p-2 rounded-xl border transition-all text-caption ${
              budgetPeriodMode === 'month'
                ? 'bg-gold/15 border-gold/30 text-gold'
                : 'bg-white/5 border-separator text-label/40 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Vue mensuelle"
            aria-pressed={budgetPeriodMode === 'month'}
          >
            <Calendar size={16} />
          </button>
          <button
            onClick={() => setBudgetPeriodMode('year')}
            className={`p-2 rounded-xl border transition-all text-caption ${
              budgetPeriodMode === 'year'
                ? 'bg-gold/15 border-gold/30 text-gold'
                : 'bg-white/5 border-separator text-label/40 hover:text-white hover:bg-white/10'
            }`}
            aria-label="Vue annuelle"
            aria-pressed={budgetPeriodMode === 'year'}
          >
            <BarChart3 size={16} />
          </button>
        </>
      }
    >
      <div className="relative">
        <div
          className="absolute top-0 left-12 right-12 h-1.5 rounded-b-full opacity-60"
          style={{ backgroundColor: getTypeColor() }}
        />

        <div className="px-8 md:px-12 pt-6 flex items-center gap-2 text-caption font-semibold text-label/40">
          <Calendar size={12} className="opacity-40" />
          <span>
            {consumption.periodeDebut} <ArrowRight size={10} className="inline opacity-20 mx-1" />{' '}
            {consumption.periodeFin}
          </span>
        </div>

        <div className="p-8 md:p-12 pt-6 space-y-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Dépensé', value: depense, color: getStatusColorClass() },
              { label: 'Budget cible', value: montant, color: 'text-white' },
              {
                label: 'Reste à vivre',
                value: reste,
                color: reste < 0 ? 'text-negative' : 'text-positive',
              },
              {
                label: 'Écart / Rythme',
                value: ecartRythme,
                color: ecartRythme > 0 ? 'text-negative' : 'text-positive',
                prefix: ecartRythme > 0 ? '+' : '',
              },
            ].map((stat, i) => (
              <div key={i} className="p-6 rounded-lg bg-white/5 border border-separator space-y-2">
                <span className="text-caption font-semibold text-label/30">{stat.label}</span>
                <div className={`text-2xl font-serif font-semibold tabular-nums ${stat.color}`}>
                  {stat.prefix}
                  {fmt(stat.value)}
                </div>
              </div>
            ))}
          </div>

          <section className="space-y-6">
            <div className="flex items-center gap-4 px-2">
              <TrendingUp size={16} className="text-gold" />
              <h3 className="text-xs font-semibold text-gold">
                Évolution & Profil d&apos;utilisation
              </h3>
            </div>
            <div className="p-8 rounded-xl bg-raised/50 border border-separator">
              <div className="h-[300px] w-full">
                <BudgetTrendChart
                  consumption={consumption}
                  transactions={transactions.map((t) => ({
                    date: t.date,
                    montant: t.montant ?? 0,
                  }))}
                />
              </div>
              <p className="mt-8 text-caption font-medium text-label/20 text-center">
                La ligne pointillée représente le rythme théorique linéaire optimal
              </p>
            </div>
          </section>

          <div className="p-8 rounded-xl bg-gold/5 border border-gold/10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 blur-[80px] rounded-full -z-10" />
            <div className="space-y-2 text-center md:text-left">
              <h4 className="text-sm font-bold text-white tracking-tight">
                Projection fin de période
              </h4>
              <p className="text-caption font-medium text-label/40 leading-relaxed">
                Basé sur votre rythme moyen de{' '}
                <span className="text-white font-bold">{fmt(depense / joursPasses)}</span> par jour
              </p>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1">
              <div
                className={`text-4xl font-serif font-semibold tabular-nums ${projection > (montant || 0) ? 'text-negative' : 'text-positive'}`}
              >
                {fmt(projection)}
              </div>
              <span className="text-caption font-semibold opacity-40">
                {projection > (montant || 0) ? 'Dépassement prévu' : 'Budget respecté'}
              </span>
            </div>
          </div>

          <section className="space-y-6 pb-8 mb-safe">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-4">
                <List size={16} className="text-label/40" />
                <h3 className="text-xs font-semibold text-label/40">
                  Détail des flux ({transactions.length})
                </h3>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-separator">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5">
                    <th className="px-6 py-4 text-caption font-semibold text-label/30">Date</th>
                    <th className="px-6 py-4 text-caption font-semibold text-label/30">Libellé</th>
                    <th className="px-6 py-4 text-right text-caption font-semibold text-label/30">
                      Montant
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-caption font-bold text-label/40 tabular-nums">
                        {t.date}
                      </td>
                      <td className="px-6 py-4 text-caption font-bold text-white truncate max-w-[200px] md:max-w-md">
                        <span className="inline-flex items-center gap-2">
                          {t.libelle}
                          {linkedTxToRecurrence[t.id] && (
                            <Repeat2
                              size={12}
                              className="text-positive shrink-0"
                              aria-label="Récurrence liée"
                            />
                          )}
                        </span>
                      </td>
                      <td
                        className={`px-6 py-4 text-right text-xs font-serif font-semibold tabular-nums ${(t.montant ?? 0) < 0 ? 'text-negative' : 'text-positive'}`}
                      >
                        {fmt(t.montant ?? 0)}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-6 py-12 text-center text-caption font-semibold text-label/20"
                      >
                        Aucune transaction identifiée
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
};
