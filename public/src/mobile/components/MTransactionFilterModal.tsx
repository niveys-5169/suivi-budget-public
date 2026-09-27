import React, { useState, useMemo } from 'react';
import { RotateCcw, CheckCircle2, Circle } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { Segmented } from './shared/Segmented';
import type { TransactionFilters } from '../../hooks/useTransactions';

interface MTransactionFilterModalProps {
  isOpen: boolean;
  filters: TransactionFilters;
  onFiltersChange: (filters: Partial<TransactionFilters>) => void;
  onReset: () => void;
  onClose: () => void;
  accounts: string[];
  categories: string[];
  onPointAll?: () => void;
  onUnpointAll?: () => void;
}

const LABEL_CLS = 'block text-caption font-bold text-label-tertiary';
const SELECT_CLS =
  'w-full min-h-[44px] px-4 bg-white/5 border border-separator rounded-xl text-white text-base font-medium focus:outline-none focus:border-gold/50 transition-colors appearance-none';

export const MTransactionFilterModal: React.FC<MTransactionFilterModalProps> = ({
  isOpen,
  filters,
  onFiltersChange,
  onReset,
  onClose,
  accounts,
  categories,
  onPointAll,
  onUnpointAll,
}) => {
  const [localFilters, setLocalFilters] = useState(filters);

  // Sync local state from parent filters each time the modal opens
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setLocalFilters(filters);
  }

  const handleFilterChange = (key: keyof TransactionFilters, value: string) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onClose();
  };

  const handleReset = () => {
    onReset();
    setLocalFilters({
      search: '',
      compte: '',
      type: '',
      year: '',
      month: '',
      pointe: '',
      categorie: '',
    });
  };

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => String(currentYear - i));
  }, []);

  const monthOptions = [
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
  ];

  const activeFiltersCount = Object.entries(localFilters).filter(
    ([key, val]) => key !== 'search' && val !== '',
  ).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Filtrer"
      subtitle={
        activeFiltersCount > 0
          ? `${activeFiltersCount} filtre${activeFiltersCount > 1 ? 's' : ''} actif${
              activeFiltersCount > 1 ? 's' : ''
            }`
          : undefined
      }
      variant="sheet"
      size="sm"
    >
      <div className="px-6 py-4 space-y-4">
        {/* Bulk actions */}
        {(onPointAll || onUnpointAll) && (
          <fieldset className="space-y-2">
            <legend className={LABEL_CLS}>Actions groupées</legend>
            <div className="grid grid-cols-2 gap-2">
              {onPointAll && (
                <button
                  type="button"
                  onClick={() => {
                    onPointAll();
                    onClose();
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-white/5 border border-separator text-label-secondary text-caption font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={14} className="text-gold" />
                  Tout pointer
                </button>
              )}
              {onUnpointAll && (
                <button
                  type="button"
                  onClick={() => {
                    onUnpointAll();
                    onClose();
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-white/5 border border-separator text-label-secondary text-caption font-bold hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  <Circle size={14} className="text-label-tertiary" />
                  Dépointer tout
                </button>
              )}
            </div>
          </fieldset>
        )}

        {/* Account */}
        <label className="block space-y-2">
          <span className={LABEL_CLS}>Compte</span>
          <select
            value={localFilters.compte}
            onChange={(e) => handleFilterChange('compte', e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">Tous les comptes</option>
            {accounts.map((account) => (
              <option key={account} value={account}>
                {account}
              </option>
            ))}
          </select>
        </label>

        {/* Type */}
        <fieldset className="space-y-2">
          <legend className={LABEL_CLS}>Type</legend>
          <Segmented
            value={localFilters.type}
            onChange={(v) => handleFilterChange('type', v)}
            options={[
              { value: '', label: 'Tous' },
              { value: 'dep', label: 'Dépenses' },
              { value: 'rec', label: 'Revenus' },
            ]}
          />
        </fieldset>

        {/* Year & Month Grid */}
        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-2">
            <span className={LABEL_CLS}>Année</span>
            <select
              value={localFilters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Toutes</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className={LABEL_CLS}>Mois</span>
            <select
              value={localFilters.month}
              onChange={(e) => handleFilterChange('month', e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">Tous</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Category */}
        <label className="block space-y-2">
          <span className={LABEL_CLS}>Catégorie</span>
          <select
            value={localFilters.categorie}
            onChange={(e) => handleFilterChange('categorie', e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">Toutes</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        {/* Pointed Status */}
        <fieldset className="space-y-2">
          <legend className={LABEL_CLS}>Pointée</legend>
          <Segmented
            value={localFilters.pointe}
            onChange={(v) => handleFilterChange('pointe', v)}
            options={[
              { value: '', label: 'Toutes' },
              { value: 'oui', label: 'Pointées' },
              { value: 'non', label: 'Non-pointées' },
            ]}
          />
        </fieldset>

        {/* Sticky footer */}
        <div className="sticky bottom-0 -mx-6 px-6 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-bg/95 backdrop-blur-md border-t border-separator flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            aria-label="Réinitialiser les filtres"
            className="min-h-[44px] px-4 rounded-xl bg-white/5 border border-separator text-white hover:bg-white/10 transition-colors flex items-center justify-center"
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-white/5 border border-separator text-white text-caption font-bold hover:bg-white/10 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-gold text-bg text-caption font-bold hover:bg-gold-light transition-colors"
          >
            Appliquer
          </button>
        </div>
      </div>
    </Modal>
  );
};
