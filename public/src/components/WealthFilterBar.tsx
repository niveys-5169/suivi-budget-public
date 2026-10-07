import React from 'react';
import { useIntl } from 'react-intl';
import { Chip, Button } from '../ui';
import type { OwnerScope, WealthTypeScope } from '../hooks/useWealthScope';

const TYPE_OPTIONS = [
  { value: 'courants', labelId: 'wealth.kpi.cash' },
  { value: 'epargnelivrets', labelId: 'wealth.kpi.savings' },
  { value: 'investissements', labelId: 'wealth.kpi.investments' },
  { value: 'retraite', labelId: 'wealth.evolution.cat.retirement' },
  { value: 'immobilier', labelId: 'wealth.evolution.cat.realEstate' },
];
const ALL_TYPES = TYPE_OPTIONS.map((o) => o.value);

interface WealthFilterBarProps {
  owners: { id: string; label: string }[];
  ownerScope: OwnerScope;
  onOwnerScopeChange: (scope: OwnerScope) => void;
  typeScope: WealthTypeScope;
  onTypeScopeChange: (scope: WealthTypeScope) => void;
}

/**
 * Filtres globaux de la page Patrimoine (propriétaires + types d'actifs),
 * toujours visibles au-dessus des chiffres qu'ils affectent.
 * Types : un chip actif = catégorie affichée ; les catégories masquées sont signalées.
 */
export const WealthFilterBar: React.FC<WealthFilterBarProps> = ({
  owners,
  ownerScope,
  onOwnerScopeChange,
  typeScope,
  onTypeScopeChange,
}) => {
  const { formatMessage: t } = useIntl();

  const visibleTypes = typeScope === 'all' || typeScope.length === 0 ? ALL_TYPES : typeScope;
  const hiddenTypes = TYPE_OPTIONS.filter((o) => !visibleTypes.includes(o.value));
  const isFiltered = ownerScope !== 'all' || hiddenTypes.length > 0;

  const toggleOwner = (id: string) => {
    if (ownerScope === 'all') return onOwnerScopeChange([id]);
    const next = ownerScope.includes(id) ? ownerScope.filter((o) => o !== id) : [...ownerScope, id];
    onOwnerScopeChange(next.length === 0 || next.length === owners.length ? 'all' : next);
  };

  const toggleType = (type: string) => {
    const next = visibleTypes.includes(type)
      ? visibleTypes.filter((v) => v !== type)
      : [...visibleTypes, type];
    if (next.length === 0) return; // au moins une catégorie reste affichée
    onTypeScopeChange(next.length === ALL_TYPES.length ? 'all' : next);
  };

  const resetAll = () => {
    onOwnerScopeChange('all');
    onTypeScopeChange('all');
  };

  return (
    <div className="mx-4 md:mx-6 mt-4 flex flex-col gap-4 rounded-xl border border-separator bg-surface p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <span className="text-caption font-bold text-label-tertiary md:w-32">
          {t({ id: 'wealth.filter.owners' })}
        </span>
        <div className="flex flex-wrap gap-2">
          <Chip selected={ownerScope === 'all'} onClick={() => onOwnerScopeChange('all')}>
            {t({ id: 'wealth.filter.all' })}
          </Chip>
          {owners.map((o) => (
            <Chip
              key={o.id}
              selected={ownerScope !== 'all' && ownerScope.includes(o.id)}
              onClick={() => toggleOwner(o.id)}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <span className="text-caption font-bold text-label-tertiary md:w-32">
          {t({ id: 'wealth.filter.types' })}
        </span>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={visibleTypes.includes(o.value)}
              onClick={() => toggleType(o.value)}
            >
              {t({ id: o.labelId })}
            </Chip>
          ))}
        </div>
      </div>

      {isFiltered && (
        <div className="flex flex-wrap items-center gap-2 text-subhead text-warning">
          {hiddenTypes.length > 0 && (
            <span>
              {t({ id: 'wealth.filter.hidden' })}{' '}
              {hiddenTypes.map((o) => t({ id: o.labelId })).join(', ')}
            </span>
          )}
          <Button variant="plain" size="sm" onClick={resetAll}>
            {t({ id: 'wealth.filter.showAll' })}
          </Button>
        </div>
      )}
    </div>
  );
};
