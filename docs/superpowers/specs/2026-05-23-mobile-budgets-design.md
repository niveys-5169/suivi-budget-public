# Spec: Mobile Budgets Screen (Lot 6)

## 1. Objectif

Portage de l'interface de budget "Bankin" vers une version mobile-first optimisée, simplifiant la visualisation tout en conservant la puissance de calcul (YTD, maîtrise des dépenses, répartition revenus/dépenses).

## 2. Architecture & Components

L'écran sera situé dans `public/src/mobile/screens/BudgetsScreen.tsx`.

### Composants à créer ou adapter :

- **`MBudgetHero`** : Affiche le solde net (Revenus - Dépenses) du mois ou de l'année (YTD) en grand (`text-m-hero`).
- **`MMasteryBar`** : Barre de progression globale de la maîtrise des dépenses avec un indicateur de rythme théorique (ligne verticale pour le jour J).
- **`MBudgetMiniCard`** : Carte de budget compacte (2 colonnes) affichant l'icône, le libellé, le montant réel, et une **mini-barre de progression (3px)** en bas (couleur catégorie ou rouge si dépassement).
- **`MBudgetGrid`** : Grille 2 colonnes pour organiser les mini-cards.

## 3. Data Flow

- **Hooks consommés** :
  - `useBudget` : Pour les budgets, le mode de vue (mois/année) et la navigation temporelle.
  - `useTransactions` : Pour le calcul des consommations réelles.
- **Logique métier** : Réutiliser 100% de la logique d'agrégation de `BankinBudgetsContainer.tsx`.

## 4. Design & Typography

- **Hero Balance** : `text-m-hero` (32px), couleur `text-gold` si positif, `text-ruby` si négatif.
- **Headers de section** : `text-m-label` (12px) gras, uppercase, tracking `[0.2em]`.
- **Cards** : Radius `rounded-m-card` (20px), fond `bg-glass`, bordure `border-glass-border`.
- **Typo montants** : `text-m-title` (17px) gras, `tabular-nums`.

## 5. Audit Success Criteria

- [ ] Le switch Mensuel / Annuel (YTD) fonctionne et met à jour tous les calculs.
- [ ] La barre de maîtrise affiche correctement le % et le trait de rythme théorique.
- [ ] Les cartes de budget virent au rouge (`text-ruby` + barre rouge) en cas de dépassement.
- [ ] Le layout est propre sur un écran 360px (pas d'overlap de texte dans les mini-cards).
