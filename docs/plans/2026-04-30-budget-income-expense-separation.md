# Plan de Design : Séparation Revenus/Dépenses & Indicateur Net

## 1. Objectif

Transformer l'interface budget "Bankin" pour gérer distinctement les revenus et les dépenses. La barre de progression des revenus doit se remplir au fur et à mesure des entrées, tandis que celle des dépenses suit la consommation du budget. L'indicateur principal affichera le solde net (Revenus - Dépenses).

## 2. Architecture des Composants

### A. BankinBudgetsContainer.tsx (Data Logic)

- **Identification du type** : Utiliser `window.CATEGORIES.Revenus` pour marquer chaque budget comme `isIncome`.
- **Calculs spécifiques** :
  - `spent` pour dépenses : `Math.max(0, -netAmount)` (positif si débit).
  - `received` pour revenus : `Math.max(0, netAmount)` (positif si crédit).
- **Groupement** : Séparer la liste `categories` en `expenseCategories` et `incomeCategories`.
- **Totaux** : Calculer `totalSpent`, `totalReceived`, et `netBalance`.

### B. BankinBudgetMain.tsx (UI Layout)

- **Header** : Afficher `netBalance` en gros titre. Ajouter deux petits indicateurs en dessous : "Encaissé : +X" et "Dépensé : -Y".
- **Progress Bar Globale** : Afficher une barre "Net" ou simplement la barre de progression des dépenses (à confirmer si besoin d'une barre pour le net).
- **Sections** :
  1. Section "Revenus" avec sa propre grille.
  2. Section "Dépenses" avec sa propre grille.

### C. BankinBudgetCard.tsx (Visual Feedback)

- Ajouter une prop `isIncome`.
- **Logique de couleur** :
  - Si `isIncome` : `isTargetReached = spent >= budget`. Si oui -> Vert/Or (Succès).
  - Si `!isIncome` : `isOver = spent > budget`. Si oui -> Rouge (Alerte).
- **Barre de progression** : Inverser la logique visuelle pour les revenus si nécessaire (remplissage positif).

## 3. Data Flow

1. `useBudget` et `useTransactions` fournissent les données brutes.
2. `BankinBudgetsContainer` filtre et agrège par type (Revenu vs Dépense).
3. `BankinBudgetMain` orchestre le rendu des deux sections.
4. `BankinBudgetCard` adapte son style selon `isIncome`.

## 4. Tests et Validation

- Vérifier qu'une transaction positive dans une catégorie "Revenu" fait monter la barre.
- Vérifier que le solde net est correct (Revenus - Dépenses).
- Vérifier l'alternance mensuel/annuel.
