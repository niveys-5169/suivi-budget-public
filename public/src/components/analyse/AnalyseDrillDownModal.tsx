import React from 'react';
import type { Transaction } from '../../hooks/useTransactions';
import { Modal } from '../shared/Modal';
import { CategoryDrillDown } from './drilldowns/CategoryDrillDown';
import { BucketDrillDown } from './drilldowns/BucketDrillDown';
import { AccountsDrillDown } from './drilldowns/AccountsDrillDown';
import type { DrillDownView, CategorySummary } from './analyseTypes';

function slidePanelTitle(view: DrillDownView): string {
  switch (view.type) {
    case 'category':
      return view.categoryName;
    case 'bucket':
      return view.bucket;
    case 'budget':
      return 'Mon Budget';
    case 'accounts':
      return 'Mes Comptes';
  }
}

interface Props {
  drillDown: DrillDownView | null;
  onBack: () => void;
  rawTransactions: Transaction[];
  allCategories: CategorySummary[];
  allTransactions: Transaction[];
  monthKey: string;
  onTransactionClick: (tx: Transaction) => void;
  onDrillDown: (view: DrillDownView) => void;
}

/** Overlay de drill-down de la page Analyse (catégorie, bucket, récurrence, comptes). */
export const AnalyseDrillDownModal: React.FC<Props> = ({
  drillDown,
  onBack,
  rawTransactions,
  allCategories,
  allTransactions,
  monthKey,
  onTransactionClick,
  onDrillDown,
}) => {
  return (
    <Modal
      isOpen={!!drillDown}
      onClose={onBack}
      title={drillDown ? slidePanelTitle(drillDown) : ''}
      size="lg"
      fullHeight
    >
      {drillDown?.type === 'category' && (
        <CategoryDrillDown
          categoryName={drillDown.categoryName}
          transactions={rawTransactions.filter(
            (tx) => (tx.categorie || 'Non catégorisé') === drillDown.categoryName,
          )}
          color={allCategories.find((c) => c.name === drillDown.categoryName)?.color ?? '#818CF8'}
          totalSpent={allCategories.find((c) => c.name === drillDown.categoryName)?.amount ?? 0}
          budget={allCategories.find((c) => c.name === drillDown.categoryName)?.budget}
          onTransactionClick={onTransactionClick}
        />
      )}

      {drillDown?.type === 'bucket' && (
        <BucketDrillDown
          bucket={drillDown.bucket}
          categories={drillDown.categories}
          transactions={rawTransactions}
          onCategoryDrillDown={onDrillDown}
        />
      )}

      {drillDown?.type === 'accounts' && (
        <AccountsDrillDown transactions={allTransactions} monthKey={monthKey} />
      )}

      {drillDown?.type === 'budget' && (
        <div className="px-4 pt-6 text-label-tertiary text-sm text-center py-16">
          Vue budget complète disponible via &quot;Voir mon budget&quot;
        </div>
      )}
    </Modal>
  );
};
