# Plan : Table budget — afficher toutes les catégories

## Goal

La table détaillée du budget affiche toutes les catégories (Dépenses + Revenus), y compris celles sans budget configuré (montant = 0), pour tous les mois et périodes.

## Scope

**In scope**

- Fusionner toutes les catégories de `window.CATEGORIES` avec les entrées de budget existantes
- Afficher les catégories à budget 0 avec ligne vide (réel + écart basés sur les transactions)
- Filtrer les entrées mensuelle par `monthKey` (ne montrer que le mois courant)
- Tri : catégories avec budget > 0 en premier, puis budget = 0, ordre alphabétique dans chaque groupe
- Correction du bug save : passer le nom de catégorie (et non l'id composite) à `saveMonthlyBudget` / `saveAnnualDefault`

**Out of scope**

- Ajout de toggle pour masquer/afficher les catégories à 0
- Groupement visuel Dépenses / Revenus
- Modification du hook `useBudget.tsx`

## Implementation steps

### Étape 1 — `BudgetTable.tsx` : importer `monthKey`

Dans la destructuration de `useBudget()`, ajouter `monthKey`.

```tsx
const { monthly, annual, viewMode, monthKey, updateMonthlyBudget, updateAnnualDefault } =
  useBudget();
```

### Étape 2 — Construire la liste complète des catégories

Ajouter une fonction `buildRows()` dans le composant :

1. Récupérer toutes les catégories depuis `window.CATEGORIES` (Dépenses + Revenus)
2. Pour le mode **mensuel** : filtrer `monthly` par `monthKey`, créer un Map `categorie → entry`
   - Pour chaque catégorie de CATEGORIES : utiliser l'entrée existante ou créer un placeholder `{ id: "${monthKey}__${catName}", categorie: catName, budget: 0 }`
3. Pour le mode **annuel** : créer un Map `id → entry` depuis `budgets` (BUDGET_DEFAULTS)
   - Pour chaque catégorie de CATEGORIES : utiliser l'entrée existante ou créer un placeholder `{ id: catName, categorie: catName, budget: 0 }`
4. Ajouter les catégories présentes dans `monthly`/`annual` mais absentes de CATEGORIES (catégories dynamiques des transactions)
5. Tri : budget > 0 d'abord (alphabétique), puis budget = 0 (alphabétique)

### Étape 3 — Corriger `handleEdit` / `handleSave`

Changer `editingId` pour utiliser le **nom de catégorie** (pas l'id composite) :

```tsx
const handleEdit = (categoryName: string, currentVal: number) => { ... }
const handleSave = async (categoryName: string) => {
  // Passer directement le nom de catégorie aux fonctions save
  if (viewMode === 'monthly') await updateMonthlyBudget(categoryName, val);
  else await updateAnnualDefault(categoryName, val);
}
```

Mettre à jour les appels dans le JSX : `handleEdit(categoryName, ...)` et `handleSave(categoryName)`.

### Étape 4 — Mettre à jour le TOTAL

Le TOTAL doit sommer uniquement les lignes avec budget > 0 (ou garder toutes les lignes — à valider). Actuellement il somme `budgets` qui sera remplacé par la liste fusionnée `rows`.

## Files to modify

| File                                    | Action | Purpose                                   |
| --------------------------------------- | ------ | ----------------------------------------- |
| `public/src/components/BudgetTable.tsx` | modify | Afficher toutes les catégories + fix save |

## Risks and mitigations

| Risque                                                        | Mitigation                                           |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `window.CATEGORIES` non disponible au render                  | Fallback sur liste vide, table dégrade gracieusement |
| Bug save préexistant (id composite passé à saveMonthlyBudget) | Corrigé dans étape 3 : on passe le nom de catégorie  |
| Trop de lignes à 0 qui noient les données importantes         | Tri avec catégories configurées en premier           |
| `expenseByCategory` ne filtre pas par mois                    | Hors scope — comportement existant non modifié       |

## Open questions

- Le TOTAL doit-il inclure les lignes à budget = 0 ? (probablement non pour le total budget, mais oui pour le réel)
