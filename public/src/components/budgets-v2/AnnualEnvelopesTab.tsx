import React, { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, PiggyBank, Plus } from 'lucide-react';
import {
  Section,
  List,
  ListItem,
  Tile,
  ProgressBar,
  Button,
  Text,
  Card,
  EmptyState,
  IconButton,
  SegmentedControl,
} from '../../ui';
import { CategoryIcon } from '../CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';
import { formatCurrency } from '../../lib/formatters';
import type { AnnualEnvelope } from '../../utils/annualEnvelope';
import { sortBudgetCategories } from '../../utils/budgetSort';
import type { BudgetSortMode } from '../../hooks/usePreferences';
import { AnnualEnvelopeFormModal } from './AnnualEnvelopeFormModal';

const eur = (n: number) => formatCurrency(n, 'EUR', 'fr-FR', { maximumFractionDigits: 0 });

const echeanceLabel = (key: string) => {
  const [y = NaN, m = NaN] = key.split('-').map(Number);
  const label = new Date(y, m - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const SORT_SEGMENTS = [
  { value: 'montant' as const, label: 'Montant' },
  { value: 'alpha' as const, label: 'Alphabétique' },
  { value: 'manual' as const, label: 'Manuel' },
];

interface Props {
  envelopes: AnnualEnvelope[];
  categories: string[];
  /** Tri partagé avec l'onglet Budgets (même préférence utilisateur). */
  sortMode: BudgetSortMode;
  onSortModeChange: (mode: BudgetSortMode) => void;
  manualOrder: string[];
  onReorder: (orderedIds: string[]) => void;
}

// La poignée seule déclenche le glisser (touch-none) : le reste de la ligne
// laisse défiler la page normalement au doigt.
const SortableRow: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className="flex items-center"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <IconButton
        label={`Glisser pour réordonner ${id}`}
        variant="plain"
        size="sm"
        {...attributes}
        {...listeners}
        className="self-stretch text-label-tertiary touch-none shrink-0"
      >
        <GripVertical size={16} />
      </IconButton>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
};

/**
 * Onglet « Enveloppes » de l'écran Budgets (desktop et mobile) : ce qu'il faut
 * mettre de côté chaque mois, puis une ligne par enveloppe. Toucher une ligne
 * ouvre la fenêtre de l'enveloppe, pré-remplie.
 */
export const AnnualEnvelopesTab: React.FC<Props> = ({
  envelopes,
  categories,
  sortMode,
  onSortModeChange,
  manualOrder,
  onReorder,
}) => {
  const [editing, setEditing] = useState<AnnualEnvelope | 'new' | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const isManualSort = sortMode === 'manual';

  const sorted = useMemo(
    () =>
      sortBudgetCategories(
        envelopes.map((e) => ({ ...e, id: e.categorie, nom: e.categorie })),
        sortMode,
        manualOrder,
      ),
    [envelopes, sortMode, manualOrder],
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex((e) => e.id === active.id);
    const newIndex = sorted.findIndex((e) => e.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(sorted, oldIndex, newIndex).map((e) => e.id));
  };

  const provision = envelopes.reduce((s, e) => s + e.provisionMensuelle, 0);
  const depense = envelopes.reduce((s, e) => s + e.depense, 0);
  const total = envelopes.reduce((s, e) => s + e.montant, 0);

  return (
    <div className="flex flex-col gap-6">
      {envelopes.length === 0 ? (
        <EmptyState
          icon={<PiggyBank size={28} aria-hidden="true" />}
          title="Aucune enveloppe"
          description="Pour les dépenses qui reviennent une fois par an : vacances, impôts, assurances… On les suit sur l'année et on met de côté un peu chaque mois."
          action={{ label: 'Créer une enveloppe', onClick: () => setEditing('new') }}
        />
      ) : (
        <>
          <Card className="flex flex-col items-center gap-1 text-center">
            <Text variant="footnote" tone="tertiary">
              À mettre de côté chaque mois
            </Text>
            <Text variant="title1" tone="accent">
              {eur(provision)}
            </Text>
            <Text variant="footnote" tone="secondary">
              {eur(depense)} dépensés sur {eur(total)} prévus
            </Text>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <span className="text-caption font-semibold text-label-tertiary">Trier :</span>
            <SegmentedControl
              label="Trier les enveloppes"
              segments={SORT_SEGMENTS}
              value={sortMode}
              onChange={onSortModeChange}
            />
          </div>

          <Section
            title="Enveloppes annuelles"
            action={
              <Button variant="plain" size="sm" onClick={() => setEditing('new')}>
                <Plus size={16} aria-hidden="true" />
                Ajouter
              </Button>
            }
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sorted.map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <List>
                  {sorted.map((e) => {
                    const meta = getCategoryMeta(e.categorie);
                    const ratio = e.montant > 0 ? e.depense / e.montant : 0;
                    const row = (
                      <ListItem
                        key={e.categorie}
                        onClick={() => setEditing(e)}
                        leading={
                          <Tile>
                            <span style={{ color: meta.color }}>
                              <CategoryIcon icon={meta.icon} size={18} />
                            </span>
                          </Tile>
                        }
                        title={
                          <span className="flex items-baseline justify-between gap-2">
                            <Text variant="headline" truncate>
                              {e.categorie}
                            </Text>
                            <Text variant="subhead" tone="secondary" className="shrink-0">
                              {eur(e.depense)} / {eur(e.montant)}
                            </Text>
                          </span>
                        }
                        subtitle={
                          <span className="flex flex-col gap-1 pt-1">
                            <ProgressBar
                              value={ratio}
                              tone={ratio > 1 ? 'negative' : 'accent'}
                              label={`${e.categorie} : ${Math.round(ratio * 100)} % utilisé`}
                            />
                            <Text variant="footnote" tone="tertiary">
                              {echeanceLabel(e.echeanceKey)} · reste {eur(e.reste)} ·{' '}
                              {eur(e.provisionMensuelle)}/mois
                            </Text>
                          </span>
                        }
                      />
                    );
                    return isManualSort ? (
                      <SortableRow key={e.categorie} id={e.id}>
                        {row}
                      </SortableRow>
                    ) : (
                      row
                    );
                  })}
                </List>
              </SortableContext>
            </DndContext>
          </Section>
        </>
      )}

      {editing && (
        <AnnualEnvelopeFormModal
          isOpen
          onClose={() => setEditing(null)}
          envelope={editing === 'new' ? undefined : editing}
          categories={categories}
        />
      )}
    </div>
  );
};
