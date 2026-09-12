import React from 'react';
import { useIntl } from 'react-intl';
import { Pencil, Tag, CalendarDays, CheckCircle2, Circle, Trash2, X } from 'lucide-react';
import { Button } from '../shared/Button';

interface BulkActionsBarProps {
  count: number;
  allSelected: boolean;
  busy?: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onRename: () => void;
  onCategorize: () => void;
  onAssignMonth: () => void;
  onPoint: () => void;
  onUnpoint: () => void;
  onDelete: () => void;
}

/** Barre d'actions groupées affichée en mode sélection dès qu'au moins une transaction est cochée. */
export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  count,
  allSelected,
  busy = false,
  onSelectAll,
  onClear,
  onRename,
  onCategorize,
  onAssignMonth,
  onPoint,
  onUnpoint,
  onDelete,
}) => {
  const { formatMessage: t } = useIntl();

  return (
    <div className="sticky top-below-header z-40 -mx-4 md:-mx-10 px-4 md:px-10 py-4 bg-gold/10 backdrop-blur-xl border-b border-gold/20">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-caption font-semibold text-gold">
          {t({ id: 'tx.bulk.selected' }, { count })}
        </span>

        <button
          type="button"
          onClick={onSelectAll}
          className="text-caption font-bold text-label-secondary hover:text-white transition-colors"
        >
          {allSelected ? t({ id: 'tx.bulk.clearSelection' }) : t({ id: 'tx.bulk.selectAll' })}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onRename} disabled={busy || count === 0}>
            <Pencil size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t({ id: 'tx.bulk.rename' })}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onCategorize} disabled={busy || count === 0}>
            <Tag size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t({ id: 'tx.bulk.categorize' })}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onAssignMonth} disabled={busy || count === 0}>
            <CalendarDays size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t({ id: 'tx.bulk.month' })}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onPoint} disabled={busy || count === 0}>
            <CheckCircle2 size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t({ id: 'tx.bulk.point' })}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onUnpoint} disabled={busy || count === 0}>
            <Circle size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t({ id: 'tx.bulk.unpoint' })}</span>
          </Button>
          <Button variant="danger" size="sm" onClick={onDelete} disabled={busy || count === 0}>
            <Trash2 size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t({ id: 'tx.bulk.delete' })}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} title={t({ id: 'tx.bulk.cancel' })}>
            <X size={14} aria-hidden="true" />
            <span className="hidden sm:inline">{t({ id: 'tx.bulk.cancel' })}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
