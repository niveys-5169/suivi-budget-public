import React, { useState } from 'react';
import { useIntl } from 'react-intl';
import { Search, Filter, RotateCcw, CheckCircle2 } from 'lucide-react';
import { Modal } from './shared/Modal';
import type { TransactionFilters as ContextFilters } from '../context/TransactionContext';

type TransactionFiltersProps = {
  filters: ContextFilters;
  onFilterChange: (name: keyof ContextFilters, value: string) => void;
  onReset: () => void;
  onPointAll: () => void;
  onUnpointAll: () => void;
  categories: string[];
  years: string[];
  accounts: string[];
};

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  filters,
  onFilterChange,
  onReset,
  onPointAll,
  categories,
  years,
  accounts,
}) => {
  const { formatMessage: t } = useIntl();
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    onFilterChange(name as keyof ContextFilters, value);
  };

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, val]) => key !== 'search' && val !== '',
  ).length;

  const SELECT_CLS = `h-12 rounded-xl border border-separator bg-raised text-caption font-bold px-4 
                      text-label-secondary hover:border-separator hover:bg-white/5 focus:outline-none focus:ring-1 focus:ring-gold/20 
                      transition-all appearance-none cursor-pointer`;

  const BTN_CLS = `h-12 px-4 rounded-xl text-caption font-semibold transition-all flex items-center gap-2 
                   cursor-pointer bg-surface border border-separator text-label-tertiary hover:bg-raised hover:text-gold`;

  return (
    <>
      {/* Desktop Filter Bar */}
      <div className="hidden md:flex flex-wrap items-center gap-4 py-6">
        <div className="flex-1 min-w-[350px] relative group mx-2">
          <Search
            size={16}
            className="absolute left-5 top-1/2 -translate-y-1/2 text-label-tertiary group-focus-within:text-gold transition-colors"
          />
          <input
            type="search"
            name="search"
            value={filters.search}
            placeholder={t({ id: 'tx.filters.search.desktop' })}
            aria-label={t({ id: 'tx.filters.search.desktop' })}
            onChange={handleChange}
            className="w-full h-14 pl-12 pr-6 rounded-lg border border-separator bg-raised text-sm text-white placeholder:text-label-tertiary focus:outline-none focus:ring-1 focus:ring-gold/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            name="compte"
            value={filters.compte}
            onChange={handleChange}
            aria-label={t({ id: 'tx.filters.account' })}
            className={SELECT_CLS}
          >
            <option value="" className="bg-bg">
              {t({ id: 'tx.filters.account' })}
            </option>
            {accounts.map((acc) => (
              <option key={acc} value={acc} className="bg-bg">
                {acc}
              </option>
            ))}
          </select>

          <select
            name="type"
            value={filters.type}
            onChange={handleChange}
            aria-label={t({ id: 'tx.filters.type' })}
            className={SELECT_CLS}
          >
            <option value="" className="bg-bg">
              {t({ id: 'tx.filters.type' })}
            </option>
            <option value="dep" className="bg-bg">
              {t({ id: 'tx.filters.type.expense' })}
            </option>
            <option value="rec" className="bg-bg">
              {t({ id: 'tx.filters.type.income' })}
            </option>
          </select>

          <select
            name="year"
            value={filters.year}
            onChange={handleChange}
            aria-label={t({ id: 'tx.filters.year' })}
            className={SELECT_CLS}
          >
            <option value="" className="bg-bg">
              {t({ id: 'tx.filters.year' })}
            </option>
            {years.map((y) => (
              <option key={y} value={y} className="bg-bg">
                {y}
              </option>
            ))}
          </select>

          <select
            name="month"
            value={filters.month}
            onChange={handleChange}
            aria-label={t({ id: 'tx.filters.month' })}
            className={SELECT_CLS}
          >
            <option value="" className="bg-bg">
              {t({ id: 'tx.filters.month' })}
            </option>
            {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => (
              <option key={m} value={m} className="bg-bg">
                {new Date(2020, parseInt(m, 10) - 1).toLocaleDateString('fr-FR', {
                  month: 'long',
                })}
              </option>
            ))}
          </select>

          <select
            name="categorie"
            value={filters.categorie}
            onChange={handleChange}
            aria-label={t({ id: 'tx.filters.category' })}
            className={SELECT_CLS}
          >
            <option value="" className="bg-bg">
              {t({ id: 'tx.filters.category' })}
            </option>
            {categories.map((cat) => (
              <option key={cat} value={cat} className="bg-bg">
                {cat}
              </option>
            ))}
          </select>

          <select
            name="pointe"
            value={filters.pointe}
            onChange={handleChange}
            aria-label={t({ id: 'tx.filters.pointe' })}
            className={SELECT_CLS}
          >
            <option value="" className="bg-bg">
              {t({ id: 'tx.filters.pointe.all' })}
            </option>
            <option value="non" className="bg-bg">
              {t({ id: 'tx.filters.pointe.unreconciled' })}
            </option>
            <option value="oui" className="bg-bg">
              {t({ id: 'tx.filters.pointe.reconciled' })}
            </option>
          </select>
        </div>

        <div className="h-6 w-[1px] bg-white/5 mx-2" />

        <div className="flex items-center gap-2">
          <button
            className={BTN_CLS}
            onClick={onReset}
            title={t({ id: 'action.reset' })}
            aria-label={t({ id: 'action.reset' })}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
          <button
            className={BTN_CLS}
            onClick={onPointAll}
            title={t({ id: 'tx.filters.pointAll' })}
            aria-label={t({ id: 'tx.filters.pointAll' })}
          >
            <CheckCircle2 size={14} className="text-gold" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile Filter Bar */}
      <div className="flex md:hidden items-center gap-4 py-4">
        <div className="flex-1 relative group">
          <Search
            size={14}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-label-tertiary"
          />
          <input
            type="search"
            name="search"
            value={filters.search}
            placeholder={t({ id: 'tx.filters.search.mobile' })}
            aria-label={t({ id: 'tx.filters.search.mobile' })}
            onChange={handleChange}
            className="w-full h-12 pl-12 pr-4 rounded-lg border border-separator bg-raised text-sm text-white focus:outline-none focus:ring-1 focus:ring-gold/20 transition-all"
          />
        </div>
        <button
          onClick={() => setIsMobileSheetOpen(true)}
          className={`flex items-center gap-2 h-12 px-4 rounded-lg border text-caption font-semibold transition-all
            ${
              activeFiltersCount > 0
                ? 'border-gold/50 bg-gold/10 text-gold'
                : 'bg-surface border-separator text-label-tertiary'
            }`}
        >
          <Filter size={14} aria-hidden="true" />
          {activeFiltersCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-gold text-bg text-caption flex items-center justify-center font-bold -ml-1 mr-1">
              {activeFiltersCount}
            </span>
          )}
          {t({ id: 'tx.filters.title' })}
        </button>
      </div>

      {/* Mobile Sheet */}
      <Modal
        isOpen={isMobileSheetOpen}
        onClose={() => setIsMobileSheetOpen(false)}
        title={t({ id: 'tx.filters.mobile.title' })}
        subtitle={t({ id: 'tx.filters.mobile.subtitle' })}
        size="md"
        fullHeight={false}
      >
        <div className="p-6 space-y-8">
          <div className="flex flex-col gap-4">
            <label
              htmlFor="tx-filter-compte-mobile"
              className="text-caption font-semibold text-label-tertiary"
            >
              {t({ id: 'tx.filters.account.label' })}
            </label>
            <select
              id="tx-filter-compte-mobile"
              name="compte"
              value={filters.compte}
              onChange={handleChange}
              className="w-full min-h-[44px] rounded-control bg-surface border border-separator text-white px-4 font-bold text-base appearance-none outline-none focus:border-gold/40"
            >
              <option value="" className="bg-bg">
                {t({ id: 'tx.filters.account.all' })}
              </option>
              {accounts.map((acc) => (
                <option key={acc} value={acc} className="bg-bg">
                  {acc}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <label
                htmlFor="tx-filter-year-mobile"
                className="text-caption font-semibold text-label-tertiary"
              >
                {t({ id: 'tx.filters.year' })}
              </label>
              <select
                id="tx-filter-year-mobile"
                name="year"
                value={filters.year}
                onChange={handleChange}
                className="w-full min-h-[44px] rounded-control bg-surface border border-separator text-white px-4 font-bold text-base appearance-none outline-none focus:border-gold/40"
              >
                <option value="" className="bg-bg">
                  {t({ id: 'tx.filters.year.all' })}
                </option>
                {years.map((y) => (
                  <option key={y} value={y} className="bg-bg">
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-4">
              <label
                htmlFor="tx-filter-month-mobile"
                className="text-caption font-semibold text-label-tertiary"
              >
                {t({ id: 'tx.filters.month' })}
              </label>
              <select
                id="tx-filter-month-mobile"
                name="month"
                value={filters.month}
                onChange={handleChange}
                className="w-full min-h-[44px] rounded-control bg-surface border border-separator text-white px-4 font-bold text-base appearance-none outline-none focus:border-gold/40"
              >
                <option value="" className="bg-bg">
                  {t({ id: 'tx.filters.month.all' })}
                </option>
                {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                  (m) => (
                    <option key={m} value={m} className="bg-bg">
                      {new Date(2020, parseInt(m, 10) - 1).toLocaleDateString('fr-FR', {
                        month: 'long',
                      })}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label
              htmlFor="tx-filter-cat-mobile"
              className="text-caption font-semibold text-label-tertiary"
            >
              {t({ id: 'tx.filters.category.label' })}
            </label>
            <select
              id="tx-filter-cat-mobile"
              name="categorie"
              value={filters.categorie}
              onChange={handleChange}
              className="w-full min-h-[44px] rounded-control bg-surface border border-separator text-white px-4 font-bold text-base appearance-none outline-none focus:border-gold/40"
            >
              <option value="" className="bg-bg">
                {t({ id: 'tx.filters.category.all' })}
              </option>
              {categories.map((cat) => (
                <option key={cat} value={cat} className="bg-bg">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-4">
            <label
              htmlFor="tx-filter-pointe-mobile"
              className="text-caption font-semibold text-label-tertiary"
            >
              {t({ id: 'tx.filters.pointe.label' })}
            </label>
            <select
              id="tx-filter-pointe-mobile"
              name="pointe"
              value={filters.pointe}
              onChange={handleChange}
              className="w-full min-h-[44px] rounded-control bg-surface border border-separator text-white px-4 font-bold text-base appearance-none outline-none focus:border-gold/40"
            >
              <option value="" className="bg-bg">
                {t({ id: 'tx.filters.pointe.all' })}
              </option>
              <option value="non" className="bg-bg">
                {t({ id: 'tx.filters.pointe.unreconciled' })}
              </option>
              <option value="oui" className="bg-bg">
                {t({ id: 'tx.filters.pointe.reconciled' })}
              </option>
            </select>
          </div>

          <div className="flex gap-4 pt-4 border-t border-separator pb-safe">
            <button
              onClick={() => {
                onReset();
                setIsMobileSheetOpen(false);
              }}
              className="flex-1 min-h-[44px] rounded-control bg-surface border border-separator text-caption font-semibold text-label-tertiary"
            >
              {t({ id: 'action.reset' })}
            </button>
            <button
              onClick={() => setIsMobileSheetOpen(false)}
              className="flex-1 min-h-[44px] rounded-control bg-gold text-bg text-caption font-semibold shadow-lg shadow-gold/20"
            >
              {t({ id: 'action.apply' })}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
