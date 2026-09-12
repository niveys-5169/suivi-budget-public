# Plan : Refonte UI mobile-first dans Suivi-Budget

> **Exécution : Gemini code, Claude audite chaque PR.** Toutes les sections "Audit" listent exactement ce que Claude va vérifier. Si une exigence est ambiguë, **Gemini doit demander avant de coder**, pas inventer.

---

## 1. Contexte

5 captures iPhone (jointes par l'utilisateur) montrent les 5 écrans principaux après le merge de la PR #567 : hero numbers oversized (`text-5xl md:text-7xl lg:text-8xl` = 48→56→96px sur viewport 390px), chevauchements partout, recherche/filtres empilés. Verdict utilisateur : « tout est horrible et écris beaucoup trop gros ».

Cause racine identifiée par audit du code :

- `tailwind.config.js` n'a **aucun breakpoint custom** (pas de `xs:`, pas de `sm:` utilisé)
- La typographie est **hardcodée par composant**, pas d'échelle partagée
- Tous les `text-Xxl md:text-Yxl lg:text-Zxl` = **desktop-first escalation**
- 2 tentatives de "v2" partielles (`/budgets-v2/`, `/dashboard/v2/Aurum*`) déjà abandonnées avec les mêmes problèmes

Les 3 lots précédents (sticky / safe-area / leading) n'ont pas attaqué ce problème — la dette typographique est intacte.

**Décisions actées avec l'utilisateur** :

1. Refonte UI mobile **dans le même repo**, derrière feature flag, réutilisant 100% de la data layer
2. **Garder les 2 expériences distinctes** : mobile-first sur `< 768px`, UI legacy sur `≥ 768px`
3. **Référence visuelle : Bankin** (cohérent avec le dossier `/budgets-v2/bankin/` déjà présent)

**Critère de succès final mesurable** : sur iPhone 14 Pro PWA standalone, les 5 écrans ont (a) 0 chevauchement visible, (b) hero numbers ≤ 32px sur 1 ligne, (c) BottomNav 5 labels lisibles, (d) `?ui=desktop` ouvre l'ancienne UI sur iPhone pour validation A/B.

---

## 2. Architecture cible

### 2.1 Détection viewport + routing

**Nouveau fichier `public/src/AppRouter.tsx`** :

```tsx
import { useSyncExternalStore } from 'react';
import { MainApp } from './MainApp';
import { MobileApp } from './MobileApp';
import { FLAGS } from './lib/featureFlags';

const MOBILE_BREAKPOINT = '(max-width: 767px)';

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_BREAKPOINT);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): 'mobile' | 'desktop' {
  // URL override pour debug : ?ui=mobile ou ?ui=desktop
  const override = new URLSearchParams(window.location.search).get('ui');
  if (override === 'mobile' || override === 'desktop') return override;
  return window.matchMedia(MOBILE_BREAKPOINT).matches ? 'mobile' : 'desktop';
}

export const AppRouter: React.FC = () => {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => 'desktop');
  if (FLAGS.MOBILE_V3 && mode === 'mobile') return <MobileApp />;
  return <MainApp />;
};
```

**Modifier `public/src/index.tsx`** (point d'entrée Vite, à confirmer par Gemini via `cat vite.config.js`) :

- Remplacer `<MainApp />` par `<AppRouter />`. Aucune autre modification.

### 2.2 Feature flag

**Modifier `public/src/lib/featureFlags.ts`** :

- Ajouter `MOBILE_V3: false` (default false, donc rollback safe). Garder la même structure que les flags existants.

### 2.3 Design tokens mobile

**Nouveau fichier `public/src/mobile/tokens.css`** :

```css
@layer base {
  :root {
    /* Typography mobile-first — inspiré Bankin, jamais > 36px */
    --m-text-hero: 32px; /* Solde principal, KPI dominant */
    --m-text-display: 22px; /* Titres de section, KPI secondaires */
    --m-text-title: 17px; /* Titres de cards, libellés transactions */
    --m-text-body: 15px; /* Texte courant */
    --m-text-caption: 13px; /* Métadonnées (date, compte) */
    --m-text-label: 11px; /* Eyebrows uppercase */

    /* Line heights — pas de leading-none, jamais */
    --m-leading-tight: 1.15;
    --m-leading-normal: 1.4;

    /* Spacing screen */
    --m-space-x: 16px; /* Padding horizontal écran */
    --m-space-y: 20px; /* Padding vertical cards */
    --m-gap-card: 12px; /* Gap entre cards */
    --m-gap-list: 8px; /* Gap entre items de liste */

    /* Radius */
    --m-radius-card: 20px;
    --m-radius-pill: 999px;
    --m-radius-input: 12px;

    /* Hauteurs critiques */
    --m-bottom-nav-h: 60px;
    --m-header-h: 56px;
  }
}
```

**Importer dans `public/src/mobile/MobileApp.tsx`** (premier import après React) :

```tsx
import './tokens.css';
```

**Modifier `tailwind.config.js`** :

```js
theme: {
  extend: {
    screens: {
      xs: '360px',  // iPhone SE
    },
    fontSize: {
      'm-hero': ['var(--m-text-hero)', { lineHeight: 'var(--m-leading-tight)' }],
      'm-display': ['var(--m-text-display)', { lineHeight: 'var(--m-leading-tight)' }],
      'm-title': ['var(--m-text-title)', { lineHeight: 'var(--m-leading-normal)' }],
      'm-body': ['var(--m-text-body)', { lineHeight: 'var(--m-leading-normal)' }],
      'm-caption': ['var(--m-text-caption)', { lineHeight: 'var(--m-leading-normal)' }],
      'm-label': ['var(--m-text-label)', { lineHeight: 'var(--m-leading-normal)' }],
    },
    // ... reste existant inchangé
  },
}
```

**Règle absolue** : sur mobile, **interdit d'utiliser** `text-2xl` à `text-9xl` ou `text-[XXpx]` arbitraire. Toujours `text-m-{hero,display,title,body,caption,label}`. Si Gemini en met une, Claude rejette la PR.

### 2.4 Shell mobile

**Nouveau fichier `public/src/MobileApp.tsx`** : reprend les Providers existants de `MainApp.tsx` (AppStateProvider, GlobalDataProvider, TransactionProvider, BudgetProvider, IntlProviderWrapper) + Router. Pas de Sidebar, pas de Skip-link (mobile), pas de OfflineBanner positionné en bas (à repositionner). Monte `<MobileShell />` qui contient `<Outlet />` + `<MobileBottomNav />`.

**Nouveau fichier `public/src/mobile/MobileShell.tsx`** :

- `<main>` avec `padding-top: env(safe-area-inset-top)` + `padding-bottom: calc(var(--m-bottom-nav-h) + env(safe-area-inset-bottom))`.
- **PAS de `position: sticky` au niveau du shell**. Aucun `-mt-safe`. Le header de chaque écran est en flow normal (pas sticky).
- **PAS de `overflow-x: hidden` nulle part dans le shell** (cause racine prouvée du sticky cassé en Lot 1). Si besoin de clip horizontal, utiliser `overflow-x: clip` localement sur un élément précis.

### 2.5 BottomNav mobile

**Nouveau fichier `public/src/mobile/MobileBottomNav.tsx`** :

- 5 items max, hauteur `var(--m-bottom-nav-h)` (60px) + `env(safe-area-inset-bottom)`
- Chaque cellule : `flex-1 min-w-0 overflow-hidden flex-col items-center justify-center`
- Label : `text-m-label` (11px), `truncate`, `text-center`, `tracking-normal` (PAS de `tracking-wider`), `whitespace-nowrap`
- Icône Lucide 20px
- Items : `{ to: '/', icon: LayoutDashboard, label: 'Console' }`, Flux, Analyse, Budgets, Audit
- État actif : `text-gold` + petit indicator point en bas
- **Test obligatoire** : viewport 360px (iPhone SE), les 5 labels doivent être 100% lisibles

---

## 3. Découpage en PR (1 PR = 1 lot)

### Lot 1 — Foundation (Gemini : ~1 journée)

**Fichiers créés/modifiés** :

- `public/src/AppRouter.tsx` (nouveau, voir §2.1)
- `public/src/MobileApp.tsx` (nouveau, voir §2.4)
- `public/src/mobile/MobileShell.tsx` (nouveau, voir §2.4)
- `public/src/mobile/MobileBottomNav.tsx` (nouveau, voir §2.5)
- `public/src/mobile/tokens.css` (nouveau, voir §2.3)
- `public/src/lib/featureFlags.ts` (modifié : +1 ligne `MOBILE_V3: false`)
- `tailwind.config.js` (modifié : +fontSize tokens, +xs breakpoint, voir §2.3)
- `public/src/index.tsx` (modifié : `<MainApp />` → `<AppRouter />`)

**Routes mobile** (dans `MobileApp.tsx`) : `/`, `/transactions`, `/budgets`, `/analyse`, `/patrimoine`. Toutes les autres routes (`/qa`, `/advanced`, etc.) → fallback sur un écran "Disponible sur desktop uniquement".

**Comportement attendu** :

- Avec `FLAGS.MOBILE_V3 = false` : comportement identique à aujourd'hui (DOM `MainApp` intact)
- Avec `FLAGS.MOBILE_V3 = true` + viewport < 768px : chaque route mobile affiche un placeholder `<h1 className="text-m-display">Console</h1>` (etc.). BottomNav fonctionnelle.
- Avec `FLAGS.MOBILE_V3 = true` + viewport ≥ 768px : `MainApp` (legacy)
- `?ui=desktop` force `MainApp` même en mobile (debug)
- `?ui=mobile` force `MobileApp` même en desktop (debug)

**Checklist d'audit Claude (PR review)** :

- [ ] `FLAGS.MOBILE_V3` est `false` par défaut → ouvrir l'app sans flag = aucun changement visible
- [ ] `npm run typecheck` passe
- [ ] `npm run lint` passe (0 errors)
- [ ] `npm run format:check` passe
- [ ] `npm test` passe (tous les tests existants verts)
- [ ] Aucun import circulaire (Gemini : `npx madge --circular public/src/AppRouter.tsx`)
- [ ] **Aucune occurrence** de `text-2xl`/`text-3xl`/.../`text-9xl`/`text-[*px]` dans les nouveaux fichiers `public/src/mobile/**`
- [ ] **Aucune occurrence** de `overflow-x-hidden` dans `public/src/mobile/**` (utiliser `overflow-x-clip` si vraiment nécessaire)
- [ ] **Aucune occurrence** de `-mt-safe` dans `public/src/mobile/**`
- [ ] `MobileBottomNav` sur viewport 360×640 : capture Playwright, les 5 labels sont entièrement visibles (pas tronqués, pas overlap)
- [ ] L'override `?ui=desktop` fonctionne (test Playwright)
- [ ] Vercel preview affiche la PR sans crash

### Lot 2 — TransactionsScreen (Gemini : ~1 journée)

Le plus simple, sert de **modèle de référence** pour les autres écrans.

**Fichiers nouveaux** :

- `public/src/mobile/screens/TransactionsScreen.tsx`
- `public/src/mobile/components/MScreenHeader.tsx` (titre + 1 action optionnelle, non-sticky)
- `public/src/mobile/components/MSearchBar.tsx` (1 input + bouton filtre, height fixe)
- `public/src/mobile/components/MTransactionRow.tsx` (avatar catégorie + libellé + sous-ligne meta + montant)
- `public/src/mobile/components/MDateGroupHeader.tsx` (date + total du jour, non-sticky)

**Hooks consommés (réutilisés tels quels, ZÉRO modification)** :

- `useTransactions` depuis `public/src/hooks/useTransactions.tsx`

**Layout** :

1. `MScreenHeader title="Flux" rightAction={<PlusButton />}`
2. `MSearchBar` (16px padding horizontal, input height 44px)
3. Liste verticale de groupes (date headers + rows), **0 sticky**, scroll natif. Si volume gros, virtualiser avec `react-window` (déjà dans package.json à vérifier).

**Contrats de composants** :

```tsx
type MTransactionRowProps = {
  transaction: Transaction; // type depuis public/src/types/banking.types.ts
  onPress?: (id: string) => void;
};

type MDateGroupHeaderProps = {
  date: string; // ISO 'YYYY-MM-DD'
  total: number;
  currency: 'EUR';
};
```

**Typographie imposée** :

- Header titre : `text-m-display` (22px)
- Libellé transaction : `text-m-title` (17px)
- Méta (catégorie • compte) : `text-m-caption` (13px), `text-platinum/50`
- Montant : `text-m-title font-semibold tabular-nums`
- Date group : `text-m-label uppercase tracking-normal`

**Checklist d'audit Claude** :

- [ ] Aucune importation de composant `public/src/components/shared/*` (Card, PageHeader, etc. — ces composants sont desktop-only, ne pas réutiliser sur mobile)
- [ ] Aucun `text-Xxl` arbitraire
- [ ] La page rend sur iPhone 14 Pro PWA simulé Playwright : screenshot annexé à la PR
- [ ] Hero/titre ne dépasse pas 32px de hauteur effective (mesuré via `getBoundingClientRect`)
- [ ] Le bouton "+" du header est tap-target ≥ 44×44px (WCAG)
- [ ] Le scroll est fluide (Playwright trace : pas de jank > 16ms)
- [ ] Pas de chevauchement entre header, search bar, et 1er date group (assertion bounding boxes Playwright)
- [ ] Capture côte-à-côte fournie : (a) écran actuel "horrible", (b) nouveau, (c) Bankin référence

### Lot 3 — HomeScreen (Console) — ~1 jour

**Layout** :

1. `MScreenHeader title="Tableau de bord" rightAction={<EyeToggle />}`
2. Section "Solde" : `text-m-hero` (32px max) + delta 30j en pill
3. Grille quick-nav 5 boutons icônes (`xs:grid-cols-3 grid-cols-5`)
4. Liste `MAccountCard` (réutilise `MTransactionRow` avec variante)
5. Bloc budget mensuel : barre + pourcentage
6. "Dernières transactions" : 6 rows max (réutilise `MTransactionRow`)

**Hooks** : `useDashboard`, `useBalances`, `useBudget`, `usePreferences` (tous existants).

**Checklist d'audit** : identique Lot 2 + vérif que le solde ne dépasse JAMAIS 32px de hauteur, même avec 8 chiffres + euro.

### Lot 4 — PatrimoineScreen (Audit) — ~1 jour

**Layout** :

1. `MScreenHeader title="Patrimoine"`
2. `MOwnerScopePills` (TOUS / NICOLAS / ROMANE / COMMUN — pills horizontales scrollables si overflow)
3. Card hero : "Valeur nette totale" `text-m-label` + montant `text-m-hero`
4. 3 cards verticales (1 colonne) : Liquidités / Épargne / Investissements — chacune `text-m-display` pour le montant
5. Mini-graph évolution patrimoine

**Hooks** : `useWealthAggregates`, `usePatrimoine`, `usePortfolio`, `useAppState` (tous existants).

**Checklist d'audit** : identique + vérif que les pills TOUS/NICOLAS ne chevauchent jamais le hero.

### Lot 5 — AnalyseScreen — ~1.5 jour

**Layout** :

1. `MScreenHeader title="Analyse"`
2. `MMonthNavigator` (mois précédent < Mai 2026 > suivant)
3. `MSegmentedControl` (Entrées / Sorties / Récurrences)
4. Donut chart simple (réutiliser `recharts` déjà dépendance) `text-m-display` au centre
5. Liste catégories : `MCategoryRow` (icône colorée + nom + montant + barre %)

**Hooks** : `useTransactions`, `useBudget`, `useDashboard`, `useExpenseBudget` (existants).

**Checklist d'audit** : identique + vérif que la liste catégorie n'a aucun texte tronqué inattendu (pas de "1 MASQ…" type bug).

### Lot 6 — BudgetsScreen — ~1.5 jour

**Réutilise la logique métier de `public/src/components/budgets-v2/bankin/BankinBudgetsContainer.tsx`** (qui s'appelle déjà "Bankin"), mais avec les nouveaux primitives mobile et la nouvelle échelle typo.

**Layout** :

1. `MScreenHeader title="Budgets"`
2. `MSegmentedControl` Mois/Année
3. Card "Solde net du mois" `text-m-hero`
4. Mini-bar "Maîtrise des dépenses" avec % maîtrise
5. Section "Revenus & Rentrées" : grille 2 colonnes (`xs:grid-cols-1 grid-cols-2`) de mini-cards budget
6. Section "Dépenses & Budgets" : idem

**Checklist d'audit** : identique + vérif que les 2 sections sont clairement séparées (label + gap), pas de fusion visuelle comme dans le screenshot Budgets actuel.

### Lot 7 — Bascule par défaut + cleanup — ~0.5 jour

**Préconditions** : les 5 écrans validés visuellement par l'utilisateur sur son iPhone.

1. Flipper `FLAGS.MOBILE_V3: true` par défaut dans `featureFlags.ts`
2. Ajouter `e2e/mobile_pwa.spec.ts` (Playwright iPhone 14 Pro viewport) couvrant les 5 écrans avec assertions bounding box (header n'overlap pas hero, hero ≤ 40px hauteur)
3. Ajouter doc dans `docs/MOBILE_UI.md` : architecture, comment override, comment ajouter un nouvel écran

**Checklist d'audit** :

- [ ] `FLAGS.MOBILE_V3` est `true` par défaut
- [ ] Le test e2e passe sur Vercel preview
- [ ] La doc explique clairement le routage et le contrat des tokens
- [ ] Aucune suppression de code legacy dans ce lot (cleanup réservé à un lot futur)

---

## 4. Règles strictes pour Gemini

Ces règles sont **non-négociables**. Toute PR qui les viole sera rejetée en review.

1. **Pas de réutilisation des composants `public/src/components/shared/*` sur mobile**. Ces composants ont du sizing desktop (Button md = 44px mais variantes lg = 52px, Card paddings desktop). Créer des primitives `public/src/mobile/components/*` séparées.
2. **Échelle typo imposée** : uniquement `text-m-{hero,display,title,body,caption,label}`. Zéro `text-Xxl` ou `text-[XXpx]`. Audit grep automatique.
3. **Pas de `overflow-x-hidden`** dans `public/src/mobile/**`. Utiliser `overflow-x-clip` si vraiment nécessaire (et justifier en commentaire).
4. **Pas de `position: sticky` empilé** : un seul élément sticky max par écran. Si besoin de plusieurs, repenser le layout.
5. **Pas de hack `-mt-safe`** : utiliser `padding-top: env(safe-area-inset-top)` sur le `<main>` du shell, point.
6. **Aucune modification des hooks/services/types/utils existants** : si Gemini en a besoin d'un nouveau comportement, il doit ouvrir un sous-PR isolé d'amélioration de hook avant le lot UI.
7. **Pas de nouveau hook qui duplique un existant**. Si `useTransactions` ne renvoie pas un champ utile, l'étendre, pas le copier.
8. **Pas de dépendance npm ajoutée** sans validation explicite. On a déjà recharts, framer-motion, lucide-react, react-router-dom, react-intl. C'est largement assez.
9. **Chaque PR contient une capture Playwright iPhone 14 Pro** (375×812) du / des écrans modifiés + un comparatif côte-à-côte avec Bankin si applicable.
10. **Chaque PR a sa propre branche** au format `feat/mobile-v3-lot-N-XXX`, mergée séparément après audit Claude.

---

## 5. Comment Claude audite chaque PR

À chaque PR ouverte par Gemini :

1. **Lecture du diff complet** (pas seulement du résumé)
2. **Exécution locale** : `git checkout <pr-branch> && npm ci && npm run typecheck && npm run lint && npm run test && npm run build`
3. **Grep d'audit** :
   - `grep -rE "text-(2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[[0-9]+px\])" public/src/mobile/` → doit être vide
   - `grep -rn "overflow-x-hidden" public/src/mobile/` → doit être vide
   - `grep -rn "-mt-safe" public/src/mobile/` → doit être vide
   - `grep -rn "from '\.\./components/shared" public/src/mobile/` → doit être vide
4. **Vérification de la checklist du lot** (cf. §3, chaque lot a sa checklist)
5. **Visuel** : examiner les screenshots fournis par Gemini ; si manquants, refuser la PR
6. **Comparaison à Bankin** : si le lot concerne un écran avec une référence Bankin, vérifier que la hiérarchie typographique et le rythme spatial sont proches
7. **Commentaires inline** sur les lignes problématiques avec demande de correction
8. **Approbation conditionnelle** : "OK à merger si X corrigé" ou rejet motivé

---

## 6. Verification end-to-end finale (post-Lot 7)

L'utilisateur installe la PWA sur son iPhone, ouvre les 5 écrans, prend 5 nouvelles captures. Comparaison côte-à-côte avec les captures originales horribles. **Critère unique de succès** : l'utilisateur dit "c'est propre", sortant de la spirale "toujours dégueulasse".

Si non : retour en arrière via `FLAGS.MOBILE_V3 = false` (rollback 1 ligne, 0 risque) + analyse de ce qui cloche.
