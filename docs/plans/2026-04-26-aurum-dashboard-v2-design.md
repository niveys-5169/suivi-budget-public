# Design Plan: Aurum Dashboard V2 (Refonte Premium)

## 1. Contexte & Objectifs

- **Refonte UI complète** du Dashboard principal (Accueil) vers le style "Private Client" défini dans le UI Kit AURUM.
- **Thème :** Dark Mode exclusif (fonds `#0B0B14`, accents or `#D4AF37`).
- **Stratégie :** Création d'une "V2" entièrement nouvelle (`AurumDashboard.tsx`) structurée selon la maquette Figma, avant de remplacer l'existant.

## 2. Architecture & Nouveaux Composants

- **Dossier cible :** `public/src/components/dashboard/v2/`
- **`AurumBalanceHero.tsx` :** Composant majeur affichant le solde global. Utilisation de _Playfair Display_ et de fonds `glass-panel` avec flous d'arrière-plan (`blur-[120px]`).
- **`AurumAccountsList.tsx` :** Liste des comptes individuels avec fonds sombres (`bg-[#121622]`), bordures subtiles (`border-glass-border`) et micro-interactions au survol.
- **`AurumQuickActions.tsx` :** Rangée de boutons iconographiques pour actions rapides (style secondaire du UI Kit).

## 3. Flux de Données & Intégration

- **Approche "Design-First" :** Implémentation initiale avec des données mockées statiques (ex: compte "Jean Dupont") pour assurer un "pixel perfect" sans contraintes réseau.
- **Connexion Firebase :** Une fois le design validé, remplacement des mocks par les hooks existants (`useBudget`, `usePatrimoineSnapshot`).

## 4. Gestion des Erreurs & Résilience

- **Chargement :** Utilisation de **Skeleton Loaders** (blocs asynchrones `animate-shimmer` via Tailwind) plutôt que des spinners.
- **Erreurs :** Ajout d'un `ErrorBoundary` stylisé pour encapsuler le dashboard en cas de défaillance réseau.

## 5. Tests

- Création de tests Vitest (ex: `AurumBalanceHero.test.tsx`) pour vérifier le rendu Tailwind, le formatage des devises et la robustesse des composants d'affichage.
