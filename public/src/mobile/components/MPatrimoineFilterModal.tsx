import React, { useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { RotateCcw } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { ChipGroup } from './shared/Segmented';

interface MPatrimoineFilterModalProps {
  isOpen: boolean;
  owners: string[];
  ownerScope: string[] | 'all';
  onChangeOwner: (scope: string[] | 'all') => void;
  wealthTypeScope: string[] | 'all';
  onChangeType: (scope: string[] | 'all') => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'courants', label: 'Liquidités' },
  { value: 'epargnelivrets', label: 'Épargne' },
  { value: 'investissements', label: 'Investissements' },
  { value: 'retraite', label: 'Retraite' },
];

/** Bascule une valeur dans un scope, en normalisant vers 'all' si vide ou complet. */
function toggleScope(scope: string[] | 'all', value: string, totalCount: number): string[] | 'all' {
  if (scope === 'all') return [value];
  const next = scope.includes(value) ? scope.filter((v) => v !== value) : [...scope, value];
  return next.length === 0 || next.length === totalCount ? 'all' : next;
}

export const MPatrimoineFilterModal: React.FC<MPatrimoineFilterModalProps> = ({
  isOpen,
  owners,
  ownerScope,
  onChangeOwner,
  wealthTypeScope,
  onChangeType,
  onClose,
}) => {
  const { formatMessage: t } = useIntl();
  const [ownerDraft, setOwnerDraft] = useState<string[] | 'all'>(ownerScope);
  const [typeDraft, setTypeDraft] = useState<string[] | 'all'>(wealthTypeScope);

  // Resynchronise le brouillon à chaque ouverture.
  useEffect(() => {
    if (isOpen) {
      setOwnerDraft(ownerScope);
      setTypeDraft(wealthTypeScope);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleApply = () => {
    onChangeOwner(ownerDraft);
    onChangeType(typeDraft);
    onClose();
  };

  const handleReset = () => {
    setOwnerDraft('all');
    setTypeDraft('all');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t({ id: 'wealth.filter.title' })}
      variant="centered"
      size="sm"
      fullHeight={false}
    >
      <div className="px-6 py-4 space-y-4">
        <fieldset className="space-y-4">
          <legend className="text-caption font-bold text-label-tertiary">
            {t({ id: 'wealth.filter.owners' })}
          </legend>
          <ChipGroup
            options={owners.map((o) => ({ value: o, label: o }))}
            values={ownerDraft}
            onToggle={(owner) => setOwnerDraft((prev) => toggleScope(prev, owner, owners.length))}
            onAll={() => setOwnerDraft('all')}
            allLabel={t({ id: 'wealth.filter.all' })}
          />
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-caption font-bold text-label-tertiary">
            {t({ id: 'wealth.filter.types' })}
          </legend>
          <ChipGroup
            options={TYPE_OPTIONS}
            values={typeDraft}
            onToggle={(type) =>
              setTypeDraft((prev) => toggleScope(prev, type, TYPE_OPTIONS.length))
            }
            onAll={() => setTypeDraft('all')}
            allLabel={t({ id: 'wealth.filter.all' })}
          />
        </fieldset>

        <div className="sticky bottom-0 -mx-6 px-6 pt-4 pb-4 bg-bg/95 backdrop-blur-md border-t border-separator flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            aria-label={t({ id: 'action.reset' })}
            className="min-h-[44px] px-4 rounded-xl bg-white/5 border border-separator text-white hover:bg-white/10 transition-colors flex items-center justify-center"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-white/5 border border-separator text-white text-caption font-bold hover:bg-white/10 transition-colors"
          >
            {t({ id: 'action.cancel' })}
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 min-h-[44px] px-4 rounded-xl bg-gold text-bg text-caption font-bold hover:bg-gold-light transition-colors"
          >
            {t({ id: 'action.apply' })}
          </button>
        </div>
      </div>
    </Modal>
  );
};
