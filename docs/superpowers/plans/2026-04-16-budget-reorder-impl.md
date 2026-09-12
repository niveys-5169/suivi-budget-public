# Réorganisation des tuiles Budget par Glisser-Déposer - Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la possibilité de réorganiser les tuiles de catégories dans l'onglet Budget par glisser-déposer, avec persistance locale et support du long-press sur mobile.

**Architecture:** Intégration de `@dnd-kit` dans `BudgetDashboard`, extraction des tuiles dans un composant `SortableCategoryTile` et gestion de la persistance via `localStorage`.

**Tech Stack:** React, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities.

---

### Task 1: Installation des dépendances

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Ajouter les dépendances @dnd-kit**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`

- [ ] **Step 2: Vérifier l'installation**

Run: `npm list @dnd-kit/core`
Expected: La version installée s'affiche.

### Task 2: Création du composant SortableCategoryTile

**Files:**

- Create: `public/src/components/SortableCategoryTile.tsx`

- [ ] **Step 1: Créer le fichier avec la logique de tri et le style de drag**

```tsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { BudgetCategory } from '../utils/budgetHelpers';
import { fmt } from '../utils/format';
import { formatPercentage } from '../utils/budgetHelpers';

interface Props {
  cat: BudgetCategory;
  onClick: (cat: BudgetCategory) => void;
}

export const SortableCategoryTile: React.FC<Props> = ({ cat, onClick }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 1000 : 1,
    padding: '12px',
    borderRadius: '10px',
    border: '1px solid #f2f4f7',
    cursor: isDragging ? 'grabbing' : 'pointer',
    background: isDragging ? '#f9fafb' : 'transparent',
    boxShadow: isDragging ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none',
    touchAction: 'none', // Important pour le drag sur mobile
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onClick(cat)}
      onMouseEnter={(e) => !isDragging && (e.currentTarget.style.background = '#f9fafb')}
      onMouseLeave={(e) => !isDragging && (e.currentTarget.style.background = 'transparent')}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '70%' }}>
          <span style={{ fontSize: '16px' }}>{cat.icon}</span>
          <span
            style={{
              fontWeight: 600,
              color: '#344054',
              fontSize: '13px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {cat.id}
          </span>
        </div>
        <span style={{ fontWeight: 700, color: cat.color, fontSize: '13px' }}>
          {fmt(cat.spent)}
        </span>
      </div>

      <div
        style={{
          height: '5px',
          background: '#f2f4f7',
          borderRadius: '3px',
          overflow: 'hidden',
          marginBottom: '6px',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, cat.percentage)}%`,
            backgroundColor: cat.color,
            transition: 'width 0.5s ease-out',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          color: '#667085',
        }}
      >
        <span>Budget: {cat.budget > 0 ? fmt(cat.budget) : '—'}</span>
        <span style={{ fontWeight: 600 }}>{formatPercentage(cat.percentage)}</span>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add public/src/components/SortableCategoryTile.tsx
git commit -m "feat(budget): add SortableCategoryTile component"
```

### Task 3: Intégration dans BudgetDashboard

**Files:**

- Modify: `public/src/components/BudgetDashboard.tsx`

- [ ] **Step 1: Ajouter les imports et l'état de tri**

```tsx
// Ajouter ces imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableCategoryTile } from './SortableCategoryTile';

// Dans le composant BudgetDashboard, au début :
const [customOrder, setCustomOrder] = useState<string[]>(() => {
  const saved = localStorage.getItem('budget_category_order');
  return saved ? JSON.parse(saved) : [];
});

const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(TouchSensor, {
    // Délai de 250ms pour le long-press sur mobile
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  }),
);
```

- [ ] **Step 2: Mettre à jour le tri dans useMemo (data)**

```tsx
        // Modifier la fin du useMemo pour intégrer customOrder
        const sortedAll = all.sort((a, b) => {
            const indexA = customOrder.indexOf(a.id);
            const indexB = customOrder.indexOf(b.id);

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;

            // Tri par défaut pour les nouvelles catégories
            if (a.budget > 0 && b.budget === 0) return -1;
            if (a.budget === 0 && b.budget > 0) return 1;
            return b.spent - a.spent;
        });

        return {
          allCategories: sortedAll,
          // ... reste inchangé
```

- [ ] **Step 3: Ajouter le handler onDragEnd**

```tsx
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;

  if (over && active.id !== over.id) {
    const oldIndex = data?.allCategories.findIndex((c) => c.id === active.id) ?? -1;
    const newIndex = data?.allCategories.findIndex((c) => c.id === over.id) ?? -1;

    if (oldIndex !== -1 && newIndex !== -1) {
      const newAllCategories = arrayMove(data!.allCategories, oldIndex, newIndex);
      const newOrder = newAllCategories.map((c) => c.id);
      setCustomOrder(newOrder);
      localStorage.setItem('budget_category_order', JSON.stringify(newOrder));
    }
  }
};
```

- [ ] **Step 4: Modifier le rendu de la grille**

```tsx
{
  /* Remplacer le rendu de la grille par DndContext + SortableContext */
}
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
      gap: '16px',
    }}
  >
    <SortableContext
      items={data.allCategories.filter((c) => c.budget > 0 || c.spent > 0).map((c) => c.id)}
      strategy={rectSortingStrategy}
    >
      {data.allCategories
        .filter((c) => c.budget > 0 || c.spent > 0)
        .map((cat: BudgetCategory) => (
          <SortableCategoryTile key={cat.id} cat={cat} onClick={handleCategoryClick} />
        ))}
    </SortableContext>
  </div>
</DndContext>;
```

- [ ] **Step 5: Commit**

```bash
git add public/src/components/BudgetDashboard.tsx
git commit -m "feat(budget): integrate drag and drop reordering in BudgetDashboard"
```

### Task 4: Vérification finale

- [ ] **Step 1: Vérifier le build**

Run: `npm run build`
Expected: Le build réussit sans erreur.

- [ ] **Step 2: Tester la persistance**

1. Ouvrir l'application.
2. Déplacer une tuile.
3. Rafraîchir la page.
4. Vérifier que la tuile est toujours à sa nouvelle place.
