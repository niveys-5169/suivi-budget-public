# Refactoring et Optimisation des Récurrences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactoriser le panneau des récurrences pour améliorer la maintenabilité, unifier la logique de projection et ajouter un feedback utilisateur (Toasts).

**Architecture:** Extraction des sous-composants (`RecurrenceItem`, `LinkTransactionModal`), centralisation de la logique de projection dans `computeMonthOverride`, et intégration du service de notifications.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons, Firestore.

---

### Task 1: Unification de la logique de projection

**Files:**

- Modify: `public/src/components/analyse/AnalyseSection.tsx`

- [ ] **Step 1: Importer `computeMonthOverride` et nettoyer la logique de `useMemo`**

Remplacer le bloc complexe de projection par l'appel à la fonction utilitaire testée.

```typescript
// Dans public/src/components/analyse/AnalyseSection.tsx
// Remplacer les lignes ~251-335 par :
const projection = computeMonthOverride({
  monthOverride,
  isAutoPaid: monthTxKeys.has(key),
  lastDate: item.lastDate,
  viewedMonthKey,
  avgInterval: item.avgInterval,
  avgAmount: item.avgAmount,
});

if (!projection) return null as any;

return {
  key,
  label: item.label,
  category: item.category,
  freq: item.freq,
  avgAmount: projection.displayAmount,
  lastDate: item.lastDate,
  nextExpectedDate: projection.occurrenceDate,
  daysUntilNext: Math.round(
    (new Date(projection.occurrenceDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000,
  ),
  status,
  count: item.count,
  monthState: projection.monthState,
  monthOverride,
  _aliases: aliases,
} as RecurringItemEnriched & { _aliases: string[] };
```

- [ ] **Step 2: Vérifier que l'affichage reste identique**

Run: `npm run build` ou vérifier via les tests existants.

- [ ] **Step 3: Commit**

```bash
git add public/src/components/analyse/AnalyseSection.tsx
git commit -m "refactor: unify recurring projection logic in AnalyseSection"
```

---

### Task 2: Extraction de `LinkTransactionModal`

**Files:**

- Create: `public/src/components/analyse/LinkTransactionModal.tsx`
- Modify: `public/src/components/analyse/AnalyseRecurrencesPanel.tsx`

- [ ] **Step 1: Créer le composant `LinkTransactionModal`**

Transférer la logique de recherche et de sélection de transactions depuis AnalyseRecurrencesPanel vers ce nouveau fichier.

- [ ] **Step 2: Intégrer la modal dans `AnalyseRecurrencesPanel`**

Nettoyer le composant parent en déléguant la gestion de la modal au nouveau composant.

- [ ] **Step 3: Commit**

```bash
git add public/src/components/analyse/LinkTransactionModal.tsx public/src/components/analyse/AnalyseRecurrencesPanel.tsx
git commit -m "refactor: extract LinkTransactionModal from AnalyseRecurrencesPanel"
```

---

### Task 3: Extraction de `RecurrenceItem`

**Files:**

- Create: `public/src/components/analyse/RecurrenceItem.tsx`
- Modify: `public/src/components/analyse/AnalyseRecurrencesPanel.tsx`

- [ ] **Step 1: Créer le composant `RecurrenceItem`**

Gérer l'affichage d'une ligne de récurrence et ses actions (skip, link, merge).

- [ ] **Step 2: Utiliser `RecurrenceItem` dans le panneau**

Remplacer la boucle `map` par le nouveau composant.

- [ ] **Step 3: Commit**

```bash
git add public/src/components/analyse/RecurrenceItem.tsx public/src/components/analyse/AnalyseRecurrencesPanel.tsx
git commit -m "refactor: extract RecurrenceItem for better maintainability"
```

---

### Task 4: Feedback Utilisateur (Toasts)

**Files:**

- Modify: `public/src/components/analyse/AnalyseSection.tsx`
- Modify: `public/src/hooks/recurringService.ts`

- [ ] **Step 1: Ajouter des toasts dans `AnalyseSection` lors des actions**

Importer `toast` de `../../lib/toast` et l'utiliser dans les handlers d'actions (skip, link, clear).

- [ ] **Step 2: Commit**

```bash
git add public/src/components/analyse/AnalyseSection.tsx
git commit -m "feat: add toast notifications for recurring actions"
```
