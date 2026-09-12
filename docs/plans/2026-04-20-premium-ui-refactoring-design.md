# Design Spec: Refonte UI Dashboard Premium (Intégration Totale)

**Date** : 2026-04-20
**Statut** : Validé
**Objectif** : Transformer l'interface actuelle par défaut en une expérience "Premium" haute fidélité, connectée aux données réelles de l'utilisateur.

## 🎯 Vision Produit

Remplacer l'interface actuelle fragmentée par un Dashboard unique, moderne (Glassmorphism, Dark Mode) et performant, inspiré des standards "Private Client" (Revolut Metal, N26).

## 🏗 Architecture & Flux de Données

### 1. Suppression de la Dépendance au Mock

- Le fichier `public/src/hooks/useDashboardData.ts` (données fictives) sera obsolète.
- Le composant `Dashboard.tsx` sera migré pour consommer directement le hook `useDashboard.tsx` qui est branché sur Firestore.

### 2. Mapping des Données Réelles

- **BalanceHero** : `totalBalance` calculé dynamiquement à partir des comptes `LCL` et `BforBank`.
- **Sparkline** : Générée à partir de l'historique des transactions des 30 derniers jours (calculé via `useDashboard`).
- **TransactionList** : Affichage des transactions réelles (pointées/non-pointées) avec le style Premium.
- **SpendingAnalytics** : Budgets réels issus de Firestore.

## 🎨 Design Visuel (Système de Design)

### Palette de Couleurs

- **Primary/BG** : `#0A0A0B` (Noir profond)
- **Cards** : `bg-white/5` + `backdrop-blur-xl` + `border-white/10` (Glassmorphism)
- **Accents** :
  - Premium : `#D4AF37` (Gold mat)
  - Revenus : `#10B981` (Emerald)
  - Dépenses : `#EF4444` (Red Corail)

### Typographie (Inter)

- **Headers** : `font-black`, `tracking-tighter`.
- **Labels** : `uppercase`, `tracking-widest`, `text-zinc-500`.

### Animations (Framer Motion)

- **Layout** : `staggerChildren: 0.1` pour une apparition fluide.
- **Interaction** : `whileTap={{ scale: 0.98 }}` sur les cartes et boutons.

## 🛠 Stratégie d'Implémentation

### Étape 1 : Infrastructure CSS

- Configuration officielle de **Tailwind CSS** (remplacement du CDN).
- Définition des tokens de couleur dans `tailwind.config.js`.

### Étape 2 : Unification du Dashboard

- Fusionner `DashboardSection.tsx` et `PremiumDashboard`.
- Supprimer le switch "Activer Expérience Premium" pour en faire l'interface par défaut.

### Étape 3 : Connexion & Performance

- Injecter les données de `useDashboard()` dans les composants Premium.
- Implémenter des **Skeleton Screens** pour le chargement initial.

## 🧪 Plan de Test

- **Tests de Composants** : Vérifier le rendu de `BalanceHero` avec des soldes négatifs.
- **Tests d'Intégration** : Confirmer que l'ajout d'une transaction manuelle met à jour le Dashboard instantanément.
- **Performance** : Monitoring du FPS sur mobile (cible 60fps) lors des animations Recharts.
