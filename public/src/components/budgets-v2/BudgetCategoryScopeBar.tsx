import React from 'react';
import { Calculator, Eye } from 'lucide-react';

interface CategoryScope {
  id: string;
  label: string;
  included: boolean;
  isCalculated: boolean;
}

interface BudgetCategoryScopeBarProps {
  categories: CategoryScope[];
  onToggleCategory: (id: string) => void;
  onToggleCalculation: (id: string) => void;
  onIncludeAll: () => void;
  onExcludeAll: () => void;
  onReset: () => void;
}

export const BudgetCategoryScopeBar: React.FC<BudgetCategoryScopeBarProps> = ({
  categories,
  onToggleCategory,
  onToggleCalculation,
  onIncludeAll,
  onExcludeAll,
  onReset,
}) => {
  return (
    <div className="bg-raised backdrop-blur-xl rounded-xl p-6 md:p-8 border border-separator space-y-6">
      <div className="flex flex-wrap gap-2 md:gap-4">
        <button
          onClick={onIncludeAll}
          className="px-4 py-2 rounded-xl bg-white/5 border border-separator text-caption font-semibold text-label/70 hover:bg-white/10 transition-all"
        >
          Tout inclure
        </button>
        <button
          onClick={onExcludeAll}
          className="px-4 py-2 rounded-xl bg-white/5 border border-separator text-caption font-semibold text-label/70 hover:bg-white/10 transition-all"
        >
          Tout exclure
        </button>
        <button
          onClick={onReset}
          className="px-4 py-2 rounded-xl bg-white/5 border border-separator text-caption font-semibold text-label/70 hover:bg-white/10 transition-all"
        >
          Réinitialiser
        </button>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-4">
        {[...categories]
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
          .map((cat) => (
            <div
              key={cat.id}
              className={`flex items-center gap-4 px-4 py-2 rounded-xl border text-caption font-semibold transition-all ${
                cat.included ? 'bg-label/15 border-label/30' : 'bg-white/5 border-separator'
              }`}
            >
              <span
                className={`transition-colors ${cat.included ? 'text-white' : 'text-label/30'}`}
              >
                {cat.label}
              </span>

              <div className="flex items-center gap-2 ml-1 border-l border-separator pl-2">
                <button
                  onClick={() => onToggleCalculation(cat.id)}
                  className="hover:scale-110 transition-transform focus:outline-none cursor-pointer"
                  title={cat.isCalculated ? 'Désactiver le calcul' : 'Activer le calcul'}
                >
                  <Calculator
                    size={14}
                    className={cat.isCalculated ? 'text-gold' : 'text-label-tertiary'}
                  />
                </button>
                <button
                  onClick={() => onToggleCategory(cat.id)}
                  className="hover:scale-110 transition-transform focus:outline-none cursor-pointer"
                  title={cat.included ? 'Exclure de la vue' : 'Inclure dans la vue'}
                >
                  <Eye size={14} className={cat.included ? 'text-label' : 'text-label-tertiary'} />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
