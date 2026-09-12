re# Spec: Refonte de la visibilité des revenus et rentrées dans les budgets

**Date:** 2026-05-11
**Statut:** Validé par l'utilisateur

## 1. Problématique

L'utilisateur ne voit pas les sommes en entrées (revenus, remboursements) dans le tableau de bord des budgets. Actuellement, le système :

- Utilise une liste fixe de catégories pour identifier les revenus.
- Ignore les transactions positives dans les catégories de dépenses (ex: remboursements Santé).
- Calcule mal le Reste à Vivre (RAV) en mélangeant flux budgétés et flux réels de manière incohérente.

## 2. Objectifs

- Assurer que **toute transaction positive** est comptabilisée comme une entrée.
- Permettre à une catégorie (ex: Santé) d'apparaître à la fois en Entrée (remboursements) et en Sortie (dépenses nettes).
- Maintenir un suivi budgétaire basé sur le **Net** (Dépenses - Remboursements).
- Corriger le calcul du Reste à Vivre.

## 3. Architecture de la solution

### 3.1. Agrégation des données (Frontend)

Le composant `BankinBudgetsContainer.tsx` sera le pivot de la transformation.
Pour chaque catégorie `C` :

- `inflow = sum(transactions de C > 0)`
- `outflow = sum(transactions de C < 0)`
- `net = inflow + outflow` (montant signé)

**Distribution :**

- Si `inflow > 0` : Créer un objet de type `IncomeCategory` pour la section "Entrées". Montant affiché = `inflow`.
- Si `outflow < 0` OU si un budget existe pour `C` : Créer un objet de type `ExpenseCategory` pour la section "Sorties". Montant affiché = `max(0, -net)` (pour le suivi du budget).

### 3.2. Indicateurs Globaux (KPIs)

- `Total Encaissé` = $\sum (t.montant > 0)$
- `Total Dépensé` = $\sum (t.montant < 0)$
- `Solde Net` = `Total Encaissé + Total Dépensé`

### 3.3. Reste à Vivre (RAV)

Dans `RAVEditor.tsx` :

- `Reste = RevenuRef + SoldeNetDuMois + Provisions`
- `RevenuRef` : Revenu mensuel net (fixe) ou somme des revenus budgétés.

## 4. Modifications techniques

### Fichiers impactés :

1.  `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx` : Refonte de la fonction `useMemo` pour le calcul de `budgetData`.
2.  `public/src/components/budgets-v2/RAVEditor.tsx` : Mise à jour de `computedFromConfig` pour refléter la nouvelle logique de calcul.
3.  `public/src/components/budgets-v2/bankin/BankinBudgetMain.tsx` : Adaptation des props et de l'affichage si nécessaire.

## 5. Cas d'usage nominal (Exemple Santé)

- Transaction 1 : -100€ (Médecin)
- Transaction 2 : +80€ (Mutuelle)
- Budget Santé : 50€

**Résultat attendu :**

- Section **Entrées** : Santé (+80€)
- Section **Sorties** : Santé (20€ consommés sur un budget de 50€) -> Barre de progression à 40%.
- Total Encaissé inclut les 80€.
- Total Dépensé inclut les 100€.

## 6. Critères de succès

- [x] Les remboursements apparaissent dans la section "Revenus & Rentrées".
- [x] Le budget des dépenses est réduit par les rentrées d'argent de la même catégorie.
- [x] Le Reste à Vivre est cohérent avec le solde bancaire réel du mois.
- [x] Zéro régression sur les budgets purement "Dépenses" ou purement "Revenus".
