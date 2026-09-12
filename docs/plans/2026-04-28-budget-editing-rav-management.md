# 📋 Budget Editing & RAV Management System

**Date:** 2026-04-28  
**Branch:** `claude/budget-management-system-Q1UjP` (commit: `b57a4b0`)  
**Status:** ✅ IMPLEMENTED & TESTED

---

## 🎯 Objectif

Mettre en place une **gestion efficace de l'édition des budgets mensuels/annuels** et du **calcul du reste à vivre (RAV) éditable** avec la capacité d'ajouter/supprimer des catégories.

### Spécification Utilisateur

> "met en place une gestion efficace de l'edition des budgets mensuels annuel et le caclul du reste a vvre qui doit etre editable aussi en ajoutant/supprimant des cagégories"

---

## 🏗 Architecture Implémentée

### 1. **BudgetManagerPanel** (`public/src/components/budgets-v2/BudgetManagerPanel.tsx`)

Panneau collapsible pour la gestion efficace des budgets.

**Fonctionnalités:**

- **Basculement Mensuel/Annuel** : Bascule le mode de cible. La sauvegarde écrit `type: 'mensuel'` ou `type: 'annuel'` dans Firestore.
- **Édition inline du montant** : Clic sur le chiffre → Input numérique. Entrée valide, Échap annule. Sauvegarde via `BudgetContext.updateBaseBudget(categorie, montant, type)`.
- **Suppression avec confirmation** : Bouton poubelle → Confirmation requis → Appel `removeBudgetCategory()` (hard delete avec soft-delete fallback).
- **Formulaire d'ajout** : Catégorie (select des candidats + saisie custom) + montant → Validation + création immédiate.
- **KPIs en direct** :
  - Nombre de catégories actives
  - Total cumulé du mode courant (mensuel ou annuel)

**Prérequis Firestore:**

```
collections/budgets: {
  id, categorie, nom, montant, type: 'mensuel'|'annuel'|'ponctuel',
  actif: boolean, updatedAt: timestamp
}
```

---

### 2. **RAVEditor** (`public/src/components/budgets-v2/RAVEditor.tsx`)

Panneau d'édition du Reste à Vivre avec gestion des catégories de revenus/dépenses.

**Fonctionnalités:**

- **Calcul live du RAV** :
  - `RAV = Revenus − Dépenses − Provisions`
  - Barre de progression avec code couleur (rouge < 20%, jaune < 50%, vert ≥ 50%)
  - Affiche moyen brut du mois courant
- **Revenu configurable** :
  - Mode FIXE : Saisi manuellement (montant fixe)
  - Mode AUTO : Moyenne des 3 derniers mois (calculée automatiquement)
  - Basculable via bouton "AUTO" dans le champ
- **Gestion des catégories en tags** :
  - **Revenus** : Add/remove tags + input custom + suggestions cliquables
  - **Dépenses** : Idem, mais marque les dépenses suivies
  - Si vide : utilise les exclusions par défaut (Virements internes, Épargne, Prêt)
- **Aperçu en direct** : Avant sauvegarde, affiche RAV simulé, revenus, dépenses recalculés avec les nouvelles catégories.

- **Persistance** : Sauvegarde sur `metadata/rav_config` (Firestore):
  ```
  {
    revenu_mensuel_net: number | null,
    revenu_categories: string[],
    depense_categories: string[]
  }
  ```

---

### 3. **BudgetContext Enhancements** (`public/src/context/BudgetContext.tsx`)

Évolutions du contexte pour supporter le type dans les budgets.

**Nouvelles méthodes:**

```typescript
// Nouvelle signature (rétro-compatible)
updateBaseBudget(categorie: string, montant: number, type?: 'mensuel' | 'annuel')
// Type par défaut: 'mensuel'

// Nouvelle méthode
removeBudgetCategory(categorie: string): Promise<void>
// Suppression hard avec fallback soft (actif: false)
```

**Logique:**

- Si `type = 'annuel'` et `viewMode = 'annual'` → écrit `type: 'annuel'`
- Si `type = 'mensuel'` et `viewMode = 'monthly'` → écrit `type: 'mensuel'`
- Le `computedBudgets` memoïzé scale déjà le montant en fonction du type et du mode actif

---

## 🎮 Utilisation

### Par l'Utilisateur

1. **Page Budgets** (BankinBudgetsContainer par défaut ou BudgetsPage legacy)
2. **Boutons de bascule** en haut à droite :
   - `Reste à vivre` → Déploie RAVEditor
   - `Gérer les budgets` → Déploie BudgetManagerPanel
3. **Dans BudgetManagerPanel** :
   - Cliquer sur le montant pour éditer
   - Utiliser Delete pour supprimer une catégorie
   - En bas, "Ajouter une catégorie" avec select des candidats
4. **Dans RAVEditor** :
   - Cliquer "Configurer" pour passer en mode édition
   - Ajuster revenu (FIXE/AUTO), ajouter/retirer catégories
   - Voir l'aperçu en direct
   - "Sauvegarder" persiste sur le cloud

### En Développement

**Importer les composants:**

```typescript
import { BudgetManagerPanel } from './BudgetManagerPanel';
import { RAVEditor } from './RAVEditor';
import { useBudgetContext } from '../../context/BudgetContext';
```

**Accéder aux nouveaux hooks:**

```typescript
const {
  budgets,
  viewMode,
  setViewMode,
  monthKey,
  setMonthKey,
  updateBaseBudget,
  removeBudgetCategory,
  getBudgetCategoryCandidates,
} = useBudgetContext();
```

---

## 📁 Fichiers Modifiés / Créés

### ✨ Nouveaux fichiers

- `public/src/components/budgets-v2/BudgetManagerPanel.tsx` (412 lignes)
- `public/src/components/budgets-v2/RAVEditor.tsx` (574 lignes)

### 🔧 Fichiers modifiés

1. **`public/src/context/BudgetContext.tsx`** (3 changements)
   - Import `deleteDoc` de Firestore
   - Signature `updateBaseBudget` avec param `type` optionnel
   - Nouvelle méthode `removeBudgetCategory`
   - Export dans le provider

2. **`public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`** (8 changements)
   - Import des 2 nouveaux composants + `AnimatePresence`
   - 2 états : `showManager`, `showRavEditor`
   - Boutons de bascule en haut avant le render de BankinBudgetMain
   - Wraps des 2 panneaux avec `AnimatePresence`

3. **`public/src/components/budgets-v2/BudgetsPage.tsx`** (legacy, optionnel)
   - Même pattern qu'au-dessus pour la cohérence

---

## 🧪 Vérifications

### Build

```bash
npm run build
# ✅ Succès — 3004 modules transformés
```

### Type Check

```bash
npx tsc --noEmit
# ✅ Zéro erreurs introduites (BudgetManagerPanel.tsx, RAVEditor.tsx, BudgetContext.tsx)
```

### Tests Existants

```bash
npx vitest run public/src/components/budgets-v2/bankin/__tests__/BankinBudgetsContainer.test.tsx
# ✅ 1 test passed
```

---

## 🚀 Prochaines Étapes / Notes Développeur

### À faire ultérieurement

1. **Monthly overrides** : Implémenter l'édition par mois spécifique (ex: "ce mois seulement")
2. **Categories per budget type** : Filtrer les candidats par `type` (ponctuel ≠ mensuel)
3. **Bulk editing** : Multiplier l'édition sur plusieurs mois/années
4. **Archive categories** : Soft-delete avec traçabilité historique
5. **RAV projections** : Courbes de prévision mois par mois
6. **Audit trail** : Qui a modifié quoi, quand (metadata/budget_edits_log)

### Considérations Architecturales

**Limitations acceptées:**

- Pas de undo/redo (Firestore n'a pas de MVCC client-side)
- Pas de collaboration en temps réel (un utilisateur par instance)
- Pas de drag-to-reorder des catégories (couvert par BudgetCategoryScopeBar existant)

**Conventions maintenues:**

- Soft delete (actif: false) sur les budgets non-shareable
- Types stricts (BudgetContext, RAVConfig)
- Localisation FR pour les labels métier (RAV, Reste à vivre, etc.)
- Design system AURUM (Gold #D4AF37, Ink #0B0B14)

---

## 📊 Composition Actuelle

```
BankinBudgetsContainer
├── Buttons (Reste à vivre | Gérer les budgets)
├── AnimatePresence
│   ├── RAVEditor [if showRavEditor]
│   └── BudgetManagerPanel [if showManager]
└── BankinBudgetMain (grille existante)
```

Tout est **non-destructif** du flux existant. Les anciens éléments (grille Bankin, chart) restent intacts.

---

## 🔗 Références

- **Commit:** `b57a4b0` sur `claude/budget-management-system-Q1UjP`
- **Firestore Schemas:** `collections/budgets`, `collections/metadata/rav_config`
- **Types:** `RavConfigShape` (RAVEditor.ts), Budget interface (BudgetContext.ts)
- **Design:** AURUM (Gold/Ink/Platinum) — voir `DESIGN_SYSTEM.md`

---

_Prêt pour QA, test utilisateur, ou intégration dans la release suivante._
