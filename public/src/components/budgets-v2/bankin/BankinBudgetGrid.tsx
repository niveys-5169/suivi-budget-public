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
import { BankinBudgetCard } from './BankinBudgetCard';
import { CategoryDetail } from './BankinBudgetsContainer';

interface Props {
  categories: CategoryDetail[];
  onCategoryClick: (id: string) => void;
  onToggleSens?: (catId: string, current: boolean | undefined) => void;
  expectedPct?: number;
  isManualSort?: boolean;
  onReorder?: (orderedIds: string[]) => void;
}

const SortableCard: React.FC<{
  id: string;
  cat: CategoryDetail;
  onCategoryClick: (id: string) => void;
  onToggleSens?: (catId: string, current: boolean | undefined) => void;
  expectedPct?: number;
}> = ({ id, cat, onCategoryClick, onToggleSens, expectedPct }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <BankinBudgetCard
        name={cat.nom || cat.id}
        spent={cat.depense}
        budget={cat.montant}
        onClick={() => onCategoryClick(cat.id)}
        isIncome={cat.isIncome}
        storedIsIncome={cat.storedIsIncome}
        onToggleSens={onToggleSens ? () => onToggleSens(cat.id, cat.storedIsIncome) : undefined}
        expectedPct={expectedPct}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
};

export const BankinBudgetGrid: React.FC<Props> = ({
  categories,
  onCategoryClick,
  onToggleSens,
  expectedPct,
  isManualSort = false,
  onReorder,
}) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(categories, oldIndex, newIndex).map((c) => c.id));
  };

  if (!isManualSort) {
    return (
      <div className="flex flex-col gap-2">
        {categories.map((cat) => (
          <BankinBudgetCard
            key={cat.id}
            name={cat.nom || cat.id}
            spent={cat.depense}
            budget={cat.montant}
            onClick={() => onCategoryClick(cat.id)}
            isIncome={cat.isIncome}
            storedIsIncome={cat.storedIsIncome}
            onToggleSens={onToggleSens ? () => onToggleSens(cat.id, cat.storedIsIncome) : undefined}
            expectedPct={expectedPct}
          />
        ))}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <SortableCard
              key={cat.id}
              id={cat.id}
              cat={cat}
              onCategoryClick={onCategoryClick}
              onToggleSens={onToggleSens}
              expectedPct={expectedPct}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
