# Mobile UI — Architecture & Guide

## Vue d'ensemble

La PWA affiche deux expériences distinctes selon le viewport :

| Condition | Expérience               |
| --------- | ------------------------ |
| `< 768px` | Mobile-first (MobileApp) |
| `≥ 768px` | Desktop legacy (MainApp) |

La détection utilise `useSyncExternalStore` + `window.matchMedia('(max-width: 767px)')` — réactive au redimensionnement en temps réel.

---

## Feature flag

`public/src/lib/featureFlags.ts` :

```ts
MOBILE_V3: true; // active l'expérience mobile
```

Mettre à `false` pour rollback instantané (0 risque, 1 ligne).

---

## Routing

```
index.tsx → main.js
  └── AppRouter
        ├── FLAGS.MOBILE_V3 && viewport < 768px → MobileApp
        │     └── MobileShell
        │           ├── <main> (safe-area, padding nav)
        │           │     └── <Routes> (5 écrans)
        │           └── MobileBottomNav
        └── MainApp (desktop legacy, inchangé)
```

**Routes mobile** :

| Path            | Écran                     |
| --------------- | ------------------------- |
| `/`             | HomeScreen (Console)      |
| `/transactions` | TransactionsScreen (Flux) |
| `/analyse`      | AnalyseScreen             |
| `/budgets/*`    | BudgetsScreen             |
| `/patrimoine`   | PatrimoineScreen (Audit)  |
| `*`             | DesktopOnlyFallback       |

---

## Override URL (debug)

Forcer un mode via query param :

```
?ui=mobile   → force MobileApp même sur desktop
?ui=desktop  → force MainApp même sur mobile (iPhone)
```

Exemples :

```
https://your-app.vercel.app/?ui=desktop    # tester la UI legacy sur iPhone
https://your-app.vercel.app/?ui=mobile     # tester la UI mobile sur desktop
```

---

## Design tokens

Définis dans `public/src/mobile/tokens.css`, importés une seule fois dans `MobileApp.tsx`.

### Typographie

| Token Tailwind   | Variable CSS       | Taille | Usage                         |
| ---------------- | ------------------ | ------ | ----------------------------- |
| `text-m-hero`    | `--m-text-hero`    | 32px   | Solde principal, KPI dominant |
| `text-m-display` | `--m-text-display` | 22px   | Titres de section             |
| `text-m-title`   | `--m-text-title`   | 17px   | Titres de cards, libellés     |
| `text-m-body`    | `--m-text-body`    | 15px   | Texte courant                 |
| `text-m-caption` | `--m-text-caption` | 13px   | Métadonnées (date, compte)    |
| `text-m-label`   | `--m-text-label`   | 12px   | Eyebrows uppercase            |

**Règle absolue** : dans `public/src/mobile/**`, n'utiliser que ces tokens. `text-2xl` à `text-9xl` et `text-[XXpx]` sont interdits.

### Hauteurs critiques

| Variable           | Valeur | Usage                |
| ------------------ | ------ | -------------------- |
| `--m-bottom-nav-h` | 60px   | BottomNav height     |
| `--m-header-h`     | 56px   | MScreenHeader height |

---

## Ajouter un nouvel écran

1. **Créer** `public/src/mobile/screens/MonNouvelEcran.tsx`
2. **Respecter le contrat** :
   - Wrapper racine : `<div className="flex flex-col h-full overflow-y-auto pb-8">`
   - Premier enfant : `<MScreenHeader title="Mon Titre" />`
   - Typographie : uniquement les tokens `text-m-*`
   - Pas de `overflow-x-hidden`, pas de `position: sticky` en cascade
3. **Enregistrer la route** dans `public/src/MobileApp.tsx` :
   ```tsx
   <Route path="/mon-ecran" element={<MonNouvelEcran />} />
   ```
4. **Ajouter au BottomNav** si besoin dans `public/src/mobile/MobileBottomNav.tsx`
5. **Hooks** : réutiliser les hooks existants (`public/src/hooks/`), ne jamais les dupliquer

---

## Règles strictes (audit automatique à chaque PR)

```bash
# Ces commandes doivent toutes retourner vide :
grep -rE "text-(2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[[0-9]+px\])" public/src/mobile/
grep -rn "overflow-x-hidden" public/src/mobile/
grep -rn "\-mt-safe" public/src/mobile/
grep -rn "from '\.\./components/shared" public/src/mobile/
```

---

## Composants primitifs mobile

Tous dans `public/src/mobile/components/` — ne PAS réutiliser les composants `src/components/shared/` (sizing desktop).

| Composant           | Usage                                                      |
| ------------------- | ---------------------------------------------------------- |
| `MScreenHeader`     | Header de chaque écran (titre + action droite optionnelle) |
| `MSearchBar`        | Barre de recherche avec bouton filtre optionnel            |
| `MTransactionRow`   | Ligne de transaction (avatar + libellé + montant)          |
| `MDateGroupHeader`  | Séparateur de date dans les listes                         |
| `MOwnerScopePills`  | Pills TOUS / propriétaires                                 |
| `MMonthNavigator`   | Navigateur mois précédent/suivant                          |
| `MSegmentedControl` | Contrôle segmenté (Sorties/Entrées/Récurrences)            |
| `MCategoryRow`      | Ligne catégorie avec barre de progression                  |
| `MCategoryDonut`    | Donut chart Recharts avec total centré                     |
| `MDashboardSummary` | Cards entrées/sorties côte à côte                          |
| `MBudgetHero`       | Hero solde net mois/YTD                                    |
| `MMasteryBar`       | Barre maîtrise dépenses avec indicateur attendu            |
| `MBudgetGrid`       | Grille 2 colonnes de MBudgetMiniCard                       |
| `MBudgetMiniCard`   | Card catégorie budget compacte                             |
| `MAccountCard`      | Ligne compte bancaire                                      |
| `MBudgetMiniBar`    | Mini barre budget pour HomeScreen                          |
| `MQuickNav`         | Grille navigation rapide HomeScreen                        |
