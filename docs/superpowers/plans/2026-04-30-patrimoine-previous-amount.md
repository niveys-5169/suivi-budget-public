# Afficher le montant précédent - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher la valeur précédente d'un actif patrimoniaux dans le modal de modification

**Architecture:** Ajouter une fonction de requête Firestore dans le hook usePlacements, passer les données via props, et afficher conditionnellement dans le modal.

**Tech Stack:** React, TypeScript, Firestore, Framer Motion

---

## File Structure

- Modify: `public/src/hooks/usePlacements.tsx` - Ajout de `getLastPlacementSnapshot`
- Modify: `public/src/components/WealthPage.tsx` - Récupération de l'historique lors de la sélection
- Modify: `public/src/components/PlacementFormModal.tsx` - Affichage conditionnel du montant précédent

---

## Tasks

### Task 1: Ajouter getLastPlacementSnapshot dans usePlacements

**Files:**

- Modify: `public/src/hooks/usePlacements.tsx`

- [ ] **Step 1: Ajouter l'import pour les fonctions Firestore manquantes**

Localiser l'import actuel:

```typescript
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
```

Ajouter `orderBy`, `where`, et `limit`:

```typescript
import {
  collection,
  onSnapshot,
  query,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  orderBy,
  where,
  limit,
} from 'firebase/firestore';
```

- [ ] **Step 2: Ajouter la fonction getLastPlacementSnapshot**

Ajouter après la fonction `deletePlacement`:

```typescript
/**
 * Récupère le dernier snapshot historique d'un placement.
 * @param placementId - ID du placement dans la collection 'placements'
 * @returns Le dernier snapshot avec montant et date, ou null si aucun historique
 */
export async function getLastPlacementSnapshot(
  placementId: string,
): Promise<{ montant: number; date: Date } | null> {
  try {
    const historyRef = collection(dbModular, 'placement_history');
    const q = query(
      historyRef,
      where('placementId', '==', placementId),
      orderBy('date', 'desc'),
      limit(1),
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
      montant: data.montant,
      date: data.date?.toDate() || new Date(),
    };
  } catch (err) {
    console.error('Error fetching placement history:', err);
    return null;
  }
}
```

- [ ] **Step 3: Exporter la fonction depuis le hook**

Dans le retour du hook, ajouter `getLastPlacementSnapshot` à l'objet retourné:

```typescript
return {
  placements,
  loading,
  error,
  addPlacement,
  updatePlacement,
  deletePlacement,
  refresh: loadData,
  getLastPlacementSnapshot,
};
```

- [ ] **Step 4: Commit**

```bash
git add public/src/hooks/usePlacements.tsx
git commit -m "feat(patrimoine): add getLastPlacementSnapshot function"
```

---

### Task 2: Modifier WealthPage pour récupérer l'historique

**Files:**

- Modify: `public/src/components/WealthPage.tsx`

- [ ] **Step 1: Ajouter un état pour le montant précédent**

Localiser la déclaration d'état:

```typescript
const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
```

Ajouter après:

```typescript
const [previousAmount, setPreviousAmount] = useState<{ montant: number; date: Date } | null>(null);
```

- [ ] **Step 2: Importer getLastPlacementSnapshot**

Localiser l'import de usePlacements:

```typescript
import { usePlacements } from '../hooks/usePlacements';
```

Remplacer par:

```typescript
import { usePlacements, getLastPlacementSnapshot } from '../hooks/usePlacements';
```

- [ ] **Step 3: Ajouter un useEffect pour charger l'historique**

Ajouter après les useState:

```typescript
useEffect(() => {
  if (
    selectedAsset &&
    !selectedAsset.id?.startsWith('live_pf_') &&
    !selectedAsset.id?.startsWith('portfolio')
  ) {
    getLastPlacementSnapshot(selectedAsset.id).then((result) => {
      setPreviousAmount(result);
    });
  } else {
    setPreviousAmount(null);
  }
}, [selectedAsset]);
```

- [ ] **Step 4: Passer previousAmount au modal**

Localiser le rendu du PlacementFormModal:

```typescript
<PlacementFormModal
  placement={selectedAsset}
  onClose={() => {
    setSelectedAsset(null);
    setIsAddingAsset(false);
  }}
  onSave={() => {
    refreshPortfolio();
  }}
/>
```

Remplacer par:

```typescript
<PlacementFormModal
  placement={selectedAsset}
  previousAmount={previousAmount}
  onClose={() => {
    setSelectedAsset(null);
    setIsAddingAsset(false);
    setPreviousAmount(null);
  }}
  onSave={() => {
    refreshPortfolio();
  }}
/>
```

- [ ] **Step 5: Commit**

```bash
git add public/src/components/WealthPage.tsx
git commit -m "feat(patrimoine): fetch previous amount when editing asset"
```

---

### Task 3: Modifier PlacementFormModal pour afficher le montant précédent

**Files:**

- Modify: `public/src/components/PlacementFormModal.tsx`

- [ ] **Step 1: Ajouter le type pour previousAmount**

Localiser l'interface:

```typescript
interface PlacementFormModalProps {
  placement?: any;
  onClose: () => void;
  onSave: () => void;
}
```

Remplacer par:

```typescript
interface PlacementFormModalProps {
  placement?: any;
  previousAmount?: { montant: number; date: Date } | null;
  onClose: () => void;
  onSave: () => void;
}
```

- [ ] **Step 2: Ajouter la props dans la fonction**

Localiser la signature de la fonction:

```typescript
export const PlacementFormModal: React.FC<PlacementFormModalProps> = ({ placement, onClose, onSave }) => {
```

Remplacer par:

```typescript
export const PlacementFormModal: React.FC<PlacementFormModalProps> = ({ placement, previousAmount, onClose, onSave }) => {
```

- [ ] **Step 3: Ajouter la fonction de formatage de date**

Ajouter après les imports (après la ligne `import { usePlacements } from '../hooks/usePlacements';`):

```typescript
const formatDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};
```

- [ ] **Step 4: Ajouter l'affichage du montant précédent**

Localiser le champ "Valeur Actuelle (€)":

```tsx
<div className="space-y-2">
  <label className="text-[10px] font-black uppercase tracking-widest text-platinum/40">
    Valeur Actuelle (€)
  </label>
  <input
    type="number"
    required
    step="0.01"
    disabled={isLive}
    value={formData.montant}
    onChange={(e) => setFormData({ ...formData, montant: Number(e.target.value) })}
    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-gold/50 transition-colors"
  />
</div>
```

Remplacer par:

```tsx
<div className="space-y-2">
  <label className="text-[10px] font-black uppercase tracking-widest text-platinum/40">
    Valeur Actuelle (€)
  </label>
  <input
    type="number"
    required
    step="0.01"
    disabled={isLive}
    value={formData.montant}
    onChange={(e) => setFormData({ ...formData, montant: Number(e.target.value) })}
    className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white text-sm outline-none focus:border-gold/50 transition-colors"
  />
  {!isLive && previousAmount && (
    <p className="text-[10px] text-platinum/40">
      Précédent : {previousAmount.montant.toLocaleString('fr-FR')} € le{' '}
      {formatDate(previousAmount.date)}
    </p>
  )}
</div>
```

- [ ] **Step 5: Commit**

```bash
git add public/src/components/PlacementFormModal.tsx
git commit -m "feat(patrimoine): display previous amount in edit modal"
```

---

## Self-Review Checklist

- [x] Spec coverage: Toutes les exigences du spec sont couvertes par les tâches
- [x] Placeholder scan: Aucun TBD, TODO ou placeholder trouvé
- [x] Type consistency: Les types `previousAmount: { montant: number; date: Date } | null` sont cohérents entre les fichiers

---

## Plan Summary

| Task | Fichier                | Description                                     |
| ---- | ---------------------- | ----------------------------------------------- |
| 1    | usePlacements.tsx      | Ajout de `getLastPlacementSnapshot`             |
| 2    | WealthPage.tsx         | Récupération de l'historique + passage au modal |
| 3    | PlacementFormModal.tsx | Affichage conditionnel du montant précédent     |

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-patrimoine-previous-amount.md`.**

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
