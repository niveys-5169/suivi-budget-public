import React, { useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { CategoryIcon } from '../../components/CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';

interface MBudgetExclusionsModalProps {
  categories: string[];
  excluded: string[];
  onClose: () => void;
  onSave: (next: string[]) => void;
}

export const MBudgetExclusionsModal: React.FC<MBudgetExclusionsModalProps> = ({
  categories,
  excluded,
  onClose,
  onSave,
}) => {
  const [draft, setDraft] = useState<Set<string>>(() => new Set(excluded));

  // Union des catégories candidates et des catégories déjà exclues, pour qu'une
  // exclusion sans transaction reste désélectionnable.
  const allCategories = useMemo(
    () =>
      Array.from(new Set([...categories, ...excluded])).sort((a, b) => a.localeCompare(b, 'fr')),
    [categories, excluded],
  );

  const toggle = (cat: string) => {
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Catégories exclues"
      subtitle="Ignorées dans les budgets"
      variant="sheet"
      size="sm"
    >
      <div className="flex flex-col">
        {/* List */}
        <div className="p-4 space-y-2">
          {allCategories.length === 0 && (
            <p className="text-footnote text-label-tertiary text-center py-8">
              Aucune catégorie disponible.
            </p>
          )}
          {allCategories.map((cat) => {
            const meta = getCategoryMeta(cat);
            const isExcluded = draft.has(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggle(cat)}
                className="w-full flex items-center gap-4 p-2 rounded-xl bg-white/5 border border-separator hover:bg-white/10 transition-colors text-left"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                >
                  <CategoryIcon icon={meta.icon} size={14} />
                </div>
                <span className="text-body font-bold text-white truncate flex-1 min-w-0">
                  {cat}
                </span>
                <span
                  className={`w-10 h-6 rounded-full flex-shrink-0 relative transition-colors ${
                    isExcluded ? 'bg-gold' : 'bg-white/10'
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                      isExcluded ? 'left-[18px]' : 'left-0.5'
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex gap-2 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] border-t border-separator bg-bg/95 backdrop-blur-md">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-lg bg-white/5 border border-separator text-white text-caption font-bold hover:bg-white/10 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => onSave(Array.from(draft))}
            className="flex-1 py-2 px-4 rounded-lg bg-gold text-bg text-caption font-bold hover:bg-gold-light transition-colors flex items-center justify-center gap-2"
          >
            <Save size={14} />
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
};
