# Suivi-Budget — AURUM Dashboard

> Tableau de bord financier personnel haut de gamme, style Private Banking.  
> Migration en cours vers React 18 / TypeScript / Firebase depuis une base HTML/JS legacy.

---

## Sommaire

- [Présentation](#présentation)
- [Stack Technique](#stack-technique)
- [Architecture](#architecture)
- [Installation & Démarrage](#installation--démarrage)
- [Commandes](#commandes)
- [Structure du Projet](#structure-du-projet)
- [Modules Principaux](#modules-principaux)
- [Pipelines CI/CD](#pipelines-cicd)
- [Design System AURUM](#design-system-aurum)
- [Documentation](#documentation)

---

## Présentation

**Suivi-Budget** est un gestionnaire de finances personnelles à l'esthétique _Private Client_ (inspiré Revolut Metal / N26 Metal).

### Fonctionnalités clés

| Domaine            | Fonctionnalités                                                     |
| ------------------ | ------------------------------------------------------------------- |
| **Dashboard**      | Solde total agrégé, variations 30j, transactions récentes, KPIs     |
| **Transactions**   | Filtres avancés, catégorisation automatique, vue table & cartes     |
| **Budget**         | Grille mensuelle/annuelle, alertes, toggle de période, RAV éditable |
| **Gestion Budget** | Édition inline mensuel/annuel, ajout/suppression de catégories      |
| **Patrimoine**     | Agrégation multi-comptes, placements, évolution patrimoniale        |
| **Analyse**        | Donut interactif style Bankin', masquage de catégories, tooltips    |
| **IA**             | Assistant financier (Gemini/OpenAI) via `FinanceQA`                 |
| **Réconciliation** | Rapprochement bancaire automatisé avec staging Firestore            |
| **Import**         | Gmail (LCL), Linxo, Enable Banking, Tronity (véhicule électrique)   |

---

## Stack Technique

### Frontend

| Outil            | Version | Rôle                            |
| ---------------- | ------- | ------------------------------- |
| React            | 18.2    | Framework UI                    |
| TypeScript       | 5.4     | Typage strict                   |
| Vite             | 5.2     | Build & Dev Server              |
| Tailwind CSS     | 4.x     | Utilitaires CSS                 |
| Framer Motion    | 12.x    | Animations                      |
| Recharts         | 3.x     | Graphiques (budget, patrimoine) |
| React Router DOM | 7.x     | Navigation SPA                  |
| Lucide React     | 1.x     | Icônes                          |
| DnD Kit          | 6.x     | Drag & Drop (tri catégories)    |
| Zod              | 4.x     | Validation de schémas           |

### Backend

| Outil              | Version     | Rôle                       |
| ------------------ | ----------- | -------------------------- |
| Firebase Firestore | 10.x        | Base de données temps réel |
| Firebase Hosting   | —           | Hébergement SPA            |
| Firebase Functions | Python 3.11 | Fonctions serverless       |
| Google Apps Script | —           | Bridge Sheets ↔ Firestore  |
| Enable Banking API | —           | Open Banking (LCL)         |
| Linxo              | —           | Agrégation bancaire        |

### Tests

| Outil                    | Rôle                               |
| ------------------------ | ---------------------------------- |
| Vitest + Testing Library | Tests unitaires & composants React |
| jest-axe                 | Tests d'accessibilité WCAG         |
| Storybook 8              | Documentation & tests visuels UI   |
| Pytest                   | Tests backend Python               |

---

## Architecture

### Vue d'ensemble

```
Suivi-Budget/
├── public/src/                  # Application React/TS (source principale)
│   ├── components/              # Composants UI
│   │   ├── dashboard/v2/        # ✅ AURUM V2 — pages migrées
│   │   ├── budgets-v2/          # ✅ Gestion budgets + RAV
│   │   ├── analyse/             # ✅ Analyse par catégorie (donut interactif)
│   │   ├── home/                # ✅ Page d'accueil
│   │   ├── shared/              # Composants réutilisables
│   │   └── layout/              # Sidebar, navigation
│   ├── hooks/                   # Logique métier (React hooks)
│   ├── context/                 # Contextes React (Budget, App, Transactions)
│   ├── types/                   # Types TypeScript centralisés
│   └── utils/                   # Formatters financiers
├── functions/                   # Cloud Functions Python
│   └── src/                     # Ingestion, réconciliation
├── .github/workflows/           # Pipelines CI/CD
├── Code.gs / DriveApiUtils.gs   # Google Apps Script (bridge)
└── docs/                        # Documentation technique
```

### État de la Migration

| Statut                      | Module                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| ✅ **Migré React**          | Dashboard (AurumDashboard), Transactions, Budget, Gestion Budget, Patrimoine, Settings, Analyse |
| 🟡 **En cours**             | AssetScopeTabs (filtrage multi-propriétaire), optimisation charts                               |
| 🔴 **Legacy (à supprimer)** | `public/src/*.js` (budget.js, patrimoine.js), `public/*.html` sauf index/aurum                  |

### Flux de données

```
Gmail / Enable Banking / Linxo
        ↓
GitHub Actions (daily 06:00 UTC)
        ↓
Python Functions → Firestore
        ↓
React App ← Firestore real-time snapshots
        ↓
Utilisateur (AURUM Dashboard)
```

---

## Installation & Démarrage

### Prérequis

- Node.js ≥ 24 (LTS, requis par CI)
- Python ≥ 3.11
- Compte Firebase avec projet configuré
- Secrets GitHub (voir `.env.premium` pour les noms)

### Frontend

```bash
npm install
npm run dev
```

L'app sera disponible sur `http://localhost:5173`.

### Backend (fonctions Python)

```bash
cd functions
pip install -r requirements.txt
```

---

## Commandes

| Commande                  | Description                                   |
| ------------------------- | --------------------------------------------- |
| `npm run dev`             | Serveur de développement Vite                 |
| `npm run build`           | Build de production (`dist/`)                 |
| `npm run build:premium`   | Build en mode premium                         |
| `npm run preview`         | Prévisualisation du build                     |
| `npm test`                | Tests unitaires Vitest                        |
| `npm run test:ui`         | Interface graphique Vitest                    |
| `pytest`                  | Tests backend Python                          |
| `npm run lint`            | Lint TypeScript / ESLint                      |
| `npm run format`          | Formatage Prettier                            |
| `npm run typecheck`       | Vérification TypeScript sans build            |
| `npm run analyze`         | Rapport bundle (`ANALYZE=true npm run build`) |
| `npm run storybook`       | Storybook composants (`:6006`)                |
| `npm run build-storybook` | Export statique Storybook                     |

---

## Structure du Projet

### Composants clés (`public/src/components/`)

#### AURUM Dashboard V2 (`dashboard/v2/`)

| Composant                   | Rôle                                        |
| --------------------------- | ------------------------------------------- |
| `AurumDashboard.tsx`        | Orchestrateur principal — layout + routing  |
| `AurumBalanceHero.tsx`      | Hero solde total avec animation blur reveal |
| `AurumTransactionsPage.tsx` | Page transactions complète                  |
| `AurumBudgetPage.tsx`       | Page budget avec navigation temporelle      |
| `AurumWealthPage.tsx`       | Page patrimoine temps réel                  |
| `AurumSettingsPage.tsx`     | Paramètres et configuration                 |
| `AurumAIPage.tsx`           | Assistant IA financier                      |

#### Gestion Budget (`budgets-v2/`)

| Composant                 | Rôle                                            |
| ------------------------- | ----------------------------------------------- |
| `BudgetManagerPanel.tsx`  | Panneau édition inline budgets mensuels/annuels |
| `RAVEditor.tsx`           | Éditeur Reste à Vivre (revenu + catégories)     |
| `BankinBudgetGrid.tsx`    | Grille budget style Bankin'                     |
| `BudgetHeaderSummary.tsx` | KPIs budget en en-tête                          |

#### Analyse (`analyse/`)

| Composant                | Rôle                                         |
| ------------------------ | -------------------------------------------- |
| `AnalyseDonutCard.tsx`   | Donut interactif avec masquage de catégories |
| `AnalyseCategoryRow.tsx` | Ligne catégorie avec animations de reveal    |
| `AnalyseSection.tsx`     | Section complète avec onglets                |

### Hooks (`public/src/hooks/`)

| Hook                           | Responsabilité                               |
| ------------------------------ | -------------------------------------------- |
| `useBudget.tsx`                | Budgets, overrides mensuels/annuels, calculs |
| `useTransactions.tsx`          | Transactions Firestore + filtres             |
| `usePatrimoine.tsx`            | Agrégation patrimoniale                      |
| `useBalances.tsx`              | Soldes comptes bancaires                     |
| `useWealthAggregates.tsx`      | Indicateurs patrimoniaux consolidés          |
| `useAuth.tsx`                  | Authentification Firebase                    |
| `useReconciliationMetrics.tsx` | Métriques de réconciliation                  |
| `useAdvancedSettings.ts`       | Paramètres avancés (mapping, règles)         |

### Contextes (`public/src/context/`)

| Contexte                 | Données partagées                           |
| ------------------------ | ------------------------------------------- |
| `BudgetContext.tsx`      | Budgets actifs, overrides, viewMode, CRUD   |
| `AppStateContext.tsx`    | État global (comptes, transactions, soldes) |
| `TransactionContext.tsx` | Transactions filtrées et paginées           |

### Types (`public/src/types/`)

Tous les types métier sont centralisés dans `banking.types.ts` (validés avec Zod) :
`Account`, `Transaction`, `Budget`, `DashboardData`, `BalancePoint`, `Currency`, `AccountType`.

---

## Modules Principaux

### Système de Budget

Le `BudgetContext` expose une API complète pour la gestion des budgets :

```typescript
const {
  viewMode, // 'monthly' | 'annual'
  budgets, // Budget[] — montants déjà scalés au mode
  updateBaseBudget, // (categorie, montant, type?) => Promise<void>
  updateMonthlyBudget, // Override pour le mois courant uniquement
  updateAnnualDefault, // Override pour l'année courante uniquement
  removeBudgetCategory, // Suppression (hard delete + soft fallback)
} = useBudgetContext();
```

Les montants sont automatiquement scalés selon le mode :

- Base `mensuel 500€` → affiche `500` en monthly, `6 000` en annual
- Base `annuel 2000€` → affiche `167` en monthly, `2 000` en annual

Voir `docs/BUDGET_MANAGEMENT_API.md` pour la référence complète.

### RAV (Reste à Vivre)

```
RAV = Revenus − Dépenses − Provisions
```

- **Mode AUTO** : Calcule automatiquement la moyenne des 3 derniers mois de revenus
- **Mode FIXE** : Montant saisi manuellement
- Persisté dans `metadata/rav_config` sur Firestore
- Indicateur visuel : rouge < 20%, ambre < 50%, vert ≥ 50%

### Ingestion de Données (Python)

Les fonctions Python dans `functions/src/` gèrent :

| Module                      | Rôle                                    |
| --------------------------- | --------------------------------------- |
| `balance_ingestion.py`      | Ingestion des soldes via Enable Banking |
| `balance_reconciliation.py` | Rapprochement bancaire automatisé       |
| `reconciliation_actions.py` | Actions post-réconciliation             |
| `firebase_db.py`            | Wrapper Firestore pour Python           |

---

## Pipelines CI/CD

### Workflows GitHub Actions

| Workflow                  | Déclencheur                  | Rôle                                                        |
| ------------------------- | ---------------------------- | ----------------------------------------------------------- |
| `main.yml`                | Daily 06:00 UTC, dispatch    | Import Gmail (Linxo) + Enable Banking + auto-catégorisation |
| `eb-import.yml`           | Dispatch                     | Import Enable Banking (LCL Open Banking)                    |
| `tronity-import.yml`      | Schedule                     | Import données véhicule électrique (Tronity)                |
| `deploy-hosting.yml`      | Push `main`                  | Build Vite + déploiement Firebase Hosting                   |
| `deploy-functions.yml`    | Push `main`                  | Déploiement Cloud Functions Python                          |
| `frontend-ci.yml`         | PR/push `main`               | Lint + typecheck + tests (Node.js v24)                      |
| `security.yml`            | PR/push `main` + daily 05:00 | npm audit + pip-audit + CodeQL                              |
| `test-reconciliation.yml` | PR, push                     | Tests Pytest de réconciliation                              |

### Secrets requis

- `GOOGLE_TOKEN` — OAuth2 Google (Gmail + Sheets)
- `FIREBASE_CREDENTIALS` — Service account Firebase
- `EB_APP_ID`, `EB_PRIVATE_KEY`, `EB_SESSIONS`, `EB_ACCOUNT_MAPPING` — Enable Banking
- `TRONITY_*` — API Tronity

---

## Design System AURUM

### Thème : toujours dark

| Token         | Valeur    | Usage             |
| ------------- | --------- | ----------------- |
| `ink.deep`    | `#0B0B14` | Fond de page      |
| `ink.surface` | `#121622` | Cartes / surfaces |
| `aurum.gold`  | `#D4AF37` | Accent principal  |
| `platinum`    | `#EDEDED` | Texte primaire    |
| `ruby`        | `#B91C1C` | Danger / négatif  |

### Règles typographiques

- Montants hero : `font-serif text-5xl` (Playfair Display)
- Tous les nombres financiers : `[font-variant-numeric:tabular-nums]`
- Labels/badges : `text-[10px] font-bold uppercase tracking-[0.2em]`

### Conventions composants

- Cards : `glass-panel rounded-[2rem] p-6`
- Animations : Framer Motion (`staggerChildren`, spring hover)
- Barres de progression : Framer Motion (pas de CSS `transition: width`)
- Recharts : toujours `isAnimationActive={false}` (conflit Framer)

Référence complète : `DESIGN_SYSTEM.md`

---

## Documentation

| Fichier                         | Contenu                                          |
| ------------------------------- | ------------------------------------------------ |
| `DESIGN_SYSTEM.md`              | Référence complète du design system AURUM        |
| `docs/ARCH_STATE.md`            | État de la migration (migré / en cours / legacy) |
| `docs/BUDGET_MANAGEMENT_API.md` | API `BudgetContext` + Firestore schemas          |
| `docs/FEATURE_FLAGS.md`         | Flags de fonctionnalités                         |
| `docs/plans/`                   | Plans d'implémentation datés (2026-04-xx)        |
| `GEMINI.md`                     | Règles de projet pour les agents IA              |
| `CLAUDE.md`                     | Instructions Claude Code                         |

### Dernières fonctionnalités (mai 2026)

- **Budget YTD annuel** — Vue cumulative « Year-to-Date » : labels YTD, prop `totalIncomeBudget`, calcul cible revenu intelligent (`BankinBudgetMain`)
- **WealthEvolutionBudgetChart** — Catégories patrimoniales refactorisées : `epargnelivrets`, `placements`, `bourse` (anciennement `epargne/investissements/retraite`)
- **Accessibilité WCAG AA** — `Modal` partagé (`role="dialog"`, focus trap, Escape), `useFocusTrap` hook, `jest-axe` sur tous les composants critiques
- **Robustesse Firestore** — `withRetry` (backoff exponentiel), `firestoreError` (14 codes mappés FR), `toast.ts` (plus aucun `alert()`)
- **Performance bundle** — Routes lazy-loaded, `npm run analyze` pour auditer les chunks
- **Storybook 8** — Stories pour `Modal`, `PageHeader`, `MonthNavigator` + addon-a11y
- **Sécurité CI** — Workflow `security.yml` : npm audit + pip-audit + CodeQL, schedule quotidien
- **Budget Management System** — Édition inline mensuel/annuel, `RAVEditor`, gestion catégories
- **Analyse interactive** — Donut Bankin'-style, masquage catégories, animations de reveal, sync hover
- **AssetScopeTabs** — Filtrage patrimoine par propriétaire (en cours)

---

## Sécurité

- **Firestore Rules** : Authentification obligatoire, rôles `admin` via custom claims, service account dédié pour les Cloud Functions
- **CSP** : Headers Content-Security-Policy stricts sur Firebase Hosting
- **Secrets** : Aucune clé dans le code — exclusivement via GitHub Secrets et variables d'environnement
- **Audit continu** : `security.yml` exécute `npm audit` + `pip-audit` + CodeQL sur chaque PR et quotidiennement

---

_Dernière mise à jour : 2026-04-30_
