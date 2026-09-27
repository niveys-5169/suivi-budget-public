import React from 'react';
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
import { GripVertical } from 'lucide-react';
import { IconButton } from '../../ui';
import { MBudgetMiniCard } from './MBudgetMiniCard';
import type { CategoryDetail } from '../../components/budgets-v2/bankin/BankinBudgetsContainer';

interface MBudgetGridProps {
  title: string;
  color: string;
  categories: CategoryDetail[];
  onCategoryClick: (id: string) => void;
  onToggleSens?: (catId: string, current: boolean | undefined) => void;
  expectedPct?: number;
  isManualSort?: boolean;
  onReorder?: (orderedIds: string[]) => void;
}

type CardProps = Pick<MBudgetGridProps, 'onCategoryClick' | 'onToggleSens' | 'expectedPct'> & {
  cat: CategoryDetail;
};

const Card: React.FC<CardProps> = ({ cat, onCategoryClick, onToggleSens, expectedPct }) => (
  <MBudgetMiniCard
    name={cat.nom}
    spent={cat.depense}
    budget={cat.montant}
    isIncome={cat.isIncome}
    onClick={() => onCategoryClick(cat.id)}
    storedIsIncome={cat.storedIsIncome}
    onToggleSens={onToggleSens ? () => onToggleSens(cat.id, cat.storedIsIncome) : undefined}
    expectedPct={expectedPct}
  />
);

// La poignée seule déclenche le glisser (touch-none) : le reste de la carte
// laisse défiler la page normalement au doigt.
const SortableCard: React.FC<CardProps> = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.cat.id,
  });

  return (
    <div
      ref={setNodeRef}
      className="flex items-center gap-1"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <IconButton
        label={`Glisser pour réordonner ${props.cat.nom}`}
        variant="plain"
        size="sm"
        {...attributes}
        {...listeners}
        className="self-stretch text-label-tertiary touch-none shrink-0"
      >
        <GripVertical size={16} />
      </IconButton>
      <div className="flex-1 min-w-0 flex flex-col">
        <Card {...props} />
      </div>
    </div>
  );
};

export const MBudgetGrid: React.FC<MBudgetGridProps> = ({
  title,
  color,
  categories,
  onCategoryClick,
  onToggleSens,
  expectedPct,
  isManualSort = false,
  onReorder,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  if (categories.length === 0) return null;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id || !onReorder) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(categories, oldIndex, newIndex).map((c) => c.id));
  };

  const cardProps = { onCategoryClick, onToggleSens, expectedPct };

  return (
    <div className="px-4 space-y-4 mb-8">
      <h3 className="text-caption font-semibold" style={{ color }}>
        {title}
      </h3>
      {isManualSort ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={categories.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {categories.map((cat) => (
                <SortableCard key={cat.id} cat={cat} {...cardProps} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <Card key={cat.id} cat={cat} {...cardProps} />
          ))}
        </div>
      )}
    </div>
  );
};
