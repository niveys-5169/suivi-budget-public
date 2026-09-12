import React from 'react';
import { PageHeader } from '../../shared/PageHeader';
import { BankinBudgetMain } from './BankinBudgetMain';
import { MoreHorizontal } from 'lucide-react';
import TransactionList from '../../dashboard/TransactionList';
import { Transaction, BudgetConsumption } from '../../../types/banking.types';

interface Props {
  category: BudgetConsumption;
  onBack: () => void;
  onMonthChange: (date: Date) => void;
  currentMonth: Date;
  onTogglePointe: (id: string, next: boolean) => Promise<void>;
  onSaveTransaction: (payload: Partial<Transaction>) => Promise<void>;
  onOpenTransaction: (id: string) => void;
  viewMode: 'monthly' | 'annual';
}

export const BankinBudgetCategoryDetail: React.FC<Props> = ({
  category,
  onBack,
  onMonthChange,
  currentMonth,
  onTogglePointe,
  onSaveTransaction,
  onOpenTransaction,
  viewMode,
}) => {
  if (!category) return null;

  return (
    <div className="animate-in slide-in-from-right duration-500 min-h-screen bg-bg">
      <PageHeader
        title={category.nom || category.budgetId}
        onBack={onBack}
        rightActions={
          <button className="p-2 text-label-tertiary hover:text-white transition-colors">
            <MoreHorizontal size={20} />
          </button>
        }
      />

      <div className="mt-6">
        <BankinBudgetMain
          netBalance={category.isIncome ? category.depense : -category.depense}
          totalSpent={!category.isIncome ? category.depense : 0}
          totalReceived={category.isIncome ? category.depense : 0}
          totalBudget={!category.isIncome ? category.montant : 0}
          currentMonth={currentMonth}
          onMonthChange={onMonthChange}
          incomeCategories={[]}
          expenseCategories={[]}
          chartData={
            Array.isArray(category.sparklineData) &&
            category.sparklineData.length > 0 &&
            typeof category.sparklineData[0] === 'number'
              ? (category.sparklineData as number[]).map((amount, index) => ({
                  day: index + 1,
                  amount,
                }))
              : (category.sparklineData as { day: number; amount: number }[]) || []
          }
          onCategoryClick={() => {}}
          viewMode={viewMode}
        />
      </div>

      <div className="px-4 md:px-6 mt-12 space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-caption font-semibold text-label-tertiary">Dernières opérations</h3>
        </div>

        <div className="bg-raised rounded-lg border border-separator overflow-hidden backdrop-blur-sm">
          <TransactionList
            transactions={category.transactions || []}
            onToggleReconciled={onTogglePointe}
            onSaveTransaction={onSaveTransaction}
            onOpenDetail={onOpenTransaction}
          />

          {(!category.transactions || category.transactions.length === 0) && (
            <div className="p-12 text-center space-y-4">
              <p className="text-label-tertiary text-sm font-medium">
                {viewMode === 'monthly'
                  ? 'Aucune opération ce mois-ci'
                  : 'Aucune opération cette année'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
