# Plan : Graphique Stacked Area par Owner — Évolution Patrimoine

**Date** : 2026-04-19  
**Branche** : `claude/wealth-evolution-chart-HSiX4`

---

## Goal

Afficher dans l'onglet Patrimoine un graphique stacked area chart montrant l'évolution mensuelle du patrimoine total par owner (courants + épargne + bourse + PER), avec tooltip détaillant le breakdown Disponible/PER, couleurs cohérentes avec les chips PatrimoineSummary.

---

## Scope

**In scope :**

- Nouvelle collection Firestore `patrimoine_snapshots` (un doc par mois, clé = `YYYY-MM`)
- Auto-snapshot mensuel : au chargement de la page, si aucun snapshot n'existe pour le mois en cours, en créer un
- Remplacement du graphique "Évolution historique" (line chart multi-datasets) par un stacked area chart propre — 1 dataset par owner
- Tooltip hover : total owner + détail Disponible vs PER
- Couleurs owners partagées via `ownerColors.ts`

**Out of scope :**

- Bouton manuel de snapshot
- Historique rétroactif (on ne peut pas reconstituer les courants/livrets passés)
- Migration de `placement_history` vers `patrimoine_snapshots`
- Graphique doughnut (non modifié)

---

## Implementation Steps

### 1. Créer `public/src/utils/ownerColors.ts`

Extraire `OWNER_COLORS` dans un fichier partagé pour PatrimoineCharts et PatrimoineSummary.

```typescript
export const OWNER_COLORS = ['#8b5cf6', '#10b981', '#06b6d4', '#f59e0b', '#ec4899', '#6366f1'];
export const getOwnerColor = (index: number): string => OWNER_COLORS[index % OWNER_COLORS.length];
```

### 2. Définir l'interface `PatrimoineSnapshot`

Ajouter dans `public/src/types/balances.ts` (ou créer `public/src/types/patrimoine.ts`) :

```typescript
export interface OwnerSnapshot {
  courants: number;
  epargne: number;
  bourse: number;
  per: number;
  total: number;
}
export interface PatrimoineSnapshot {
  monthKey: string; // "YYYY-MM"
  date: string; // ISO date
  owners: Record<string, OwnerSnapshot>;
}
```

### 3. Mettre à jour `usePatrimoine.tsx`

- Ajouter state `patrimoineSnapshots: PatrimoineSnapshot[]`
- Ajouter listener Firestore `onSnapshot(collection(db, 'patrimoine_snapshots'), orderBy('date', 'asc'))`
- Ajouter fonction `saveSnapshot(owners: Record<string, OwnerSnapshot>)` :
  - Clé du doc = monthKey (`YYYY-MM`)
  - Utilise `setDoc(..., { merge: false })` pour écraser le snapshot du mois
  - Ne sauvegarde que si `owners` est non vide
- Exposer `patrimoineSnapshots` et `saveSnapshot` dans le return

### 4. Calculer le détail par owner dans `PatrimoineSection.tsx`

Ajouter un `useMemo` `ownerDetailedBreakdown` qui calcule pour chaque owner :

- `courants` : somme des `balances` (account_balances) de cet owner
- `epargne` : somme des `savingsBalances` + placements non-PER de cet owner
- `bourse` : part du portfolio (holdings par owner, ou valeur totale sur default_owner)
- `per` : placements de type 'per' de cet owner
- `total` : courants + epargne + bourse + per

### 5. Déclencher l'auto-snapshot dans `PatrimoineSection.tsx`

Ajouter un `useEffect` :

```typescript
useEffect(() => {
  if (loading) return;
  const monthKey = new Date().toISOString().substring(0, 7);
  const alreadyExists = patrimoineSnapshots.some((s) => s.monthKey === monthKey);
  if (!alreadyExists && Object.keys(ownerDetailedBreakdown).length > 0) {
    saveSnapshot(ownerDetailedBreakdown);
  }
}, [loading, patrimoineSnapshots, ownerDetailedBreakdown]);
```

### 6. Mettre à jour `PatrimoineCharts.tsx`

- Accepter nouvelle prop `snapshots: PatrimoineSnapshot[]` (en plus de `history` existant ou en remplacement)
- Importer `getOwnerColor` depuis `ownerColors.ts`
- Remplacer la génération du graphique "Évolution historique" :
  - Labels = `snapshots.map(s => s.monthKey)`
  - 1 dataset par owner = valeur totale par mois
  - `fill: true`, `tension: 0.3`, stacked scales
  - Tooltip custom : pour chaque owner, afficher total + "(Disponible: X | PER: Y)"
- Conserver le graphique doughnut intact

---

## Files to Create or Modify

| File                                          | Action | Purpose                                          |
| --------------------------------------------- | ------ | ------------------------------------------------ |
| `public/src/utils/ownerColors.ts`             | Create | Palette couleurs partagée                        |
| `public/src/types/patrimoine.ts`              | Create | Interface PatrimoineSnapshot                     |
| `public/src/hooks/usePatrimoine.tsx`          | Modify | Snapshots state + listener + saveSnapshot()      |
| `public/src/components/PatrimoineSection.tsx` | Modify | ownerDetailedBreakdown + auto-snapshot useEffect |
| `public/src/components/PatrimoineCharts.tsx`  | Modify | Stacked area chart par owner depuis snapshots    |

---

## Risks and Mitigations

| Risque                                           | Mitigation                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Snapshot déclenché plusieurs fois (double write) | Vérifier `alreadyExists` avant de sauvegarder + `setDoc` idempotent sur monthKey |
| Portfolio sans holdings → bourse mal attribuée   | Fallback sur `default_owner` comme actuellement                                  |
| Premier mois sans snapshots = chart vide         | Afficher message "Données en cours de collecte" si `snapshots.length === 0`      |
| Chart.js `fill: true` + stacked mal configuré    | Utiliser `fill: 'origin'` et `stacked: true` sur les deux axes                   |
| Owners sans données sur certains mois            | Retourner 0 pour les mois manquants (ne pas interpoler)                          |

---

## Open Questions

- _(résolu)_ Tooltip : oui, afficher Disponible/PER au survol
- _(résolu)_ Périmètre : tout inclure (courants + livrets + placements + PER)
- _(résolu)_ Couleurs : cohérentes avec PatrimoineSummary (OWNER_COLORS par index)
