# Plan : Suppression complète du legacy JS/HTML

## Contexte

Le frontend React est fonctionnel à 100% via `MainApp.tsx` + React Router. Mais les fichiers legacy `app.js`, `budget.js`, `patrimoine.js`, `transactions.js` restent présents et importés inconditionnellement dans `main.js`. Objectif : les supprimer proprement, sans casser le build ni aucune fonctionnalité active.

**Condition préalable :** `FLAGS.BOTTOMNAV_V2` est par défaut `true` (env var doit être explicitement `'false'` pour le désactiver). On va le rendre définitif.

---

## Dépendances critiques identifiées

| Fichier legacy    | Qui l'utilise                                                                                      | Risque                               |
| ----------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `transactions.js` | `TransactionGroupedList.tsx` (import direct de `getCatStyle`, `formatLibelle`)                     | BLOQUANT — migrer avant de supprimer |
| `app.js`          | `index.html` (onclicks `doSignOut`, `signInWithGoogle`) + `main.js` + `MainApp.tsx` (`hideLoader`) | BLOQUANT — migrer auth et loader     |
| `budget.js`       | `app.js` seulement, pas de React direct                                                            | Supprimable après app.js             |
| `patrimoine.js`   | Non importé par `main.js` ni par des composants React                                              | Supprimable immédiatement            |
| `insights.js`     | Appelle `window.getAssignedMonthKey`, `window.renderInsightsFeed`, etc.                            | Refactoriser les appels window       |

---

## Plan d'exécution (4 étapes)

### Étape 1 — Hardcoder BOTTOMNAV_V2 = true et nettoyer main.js

**Fichiers modifiés :**

- [`public/src/lib/featureFlags.ts`](public/src/lib/featureFlags.ts) — remplacer `import.meta.env.VITE_BOTTOMNAV_V2 !== 'false'` par `true`
- [`public/src/main.js`](public/src/main.js) — supprimer le bloc `else` (lignes 73–86) et les lignes 106–108 (boot legacy nav)
- [`public/src/main.js`](public/src/main.js) — supprimer les références `initPullToRefresh` aux IDs legacy (`tab-transactions`, `ptr-indicator`) si plus présents dans le HTML

**Résultat :** La branche legacy ne peut plus être activée. Aucune régression car cette branche était déjà cachée.

---

### Étape 2 — Migrer transactions.js vers TypeScript

`TransactionGroupedList.tsx` importe directement depuis `../../transactions.js`. Ce fichier contient aussi des constantes utilisées par `budget.js` et `app.js`.

**Action :**

1. Créer `public/src/utils/categoryUtils.ts` avec les exports migrés en TypeScript :
   - `ICONS`, `KEYWORD_MAP`, `CATEGORY_RULES`, `AVAILABLE_COLORS`
   - `getCatStyle(cat: string)`, `formatLibelle(libelle: string)`, `normalizeSearchValue()`, `buildAmountSearchValues()`
2. Mettre à jour l'import dans [`public/src/components/transactions/TransactionGroupedList.tsx`](public/src/components/transactions/TransactionGroupedList.tsx) :
   - Changer `from '../../transactions.js'` → `from '../../utils/categoryUtils'`
3. Chercher tout autre import de `transactions.js` dans les `.ts`/`.tsx` et les mettre à jour.
4. Supprimer `public/src/transactions.js`

---

### Étape 3 — Nettoyer app.js et migrer les dépendances actives

`app.js` expose des globals encore actifs dans React :

**3a. Migrer l'auth (`doSignOut`, `signInWithGoogle`)**

- Ces fonctions sont appelées via `onclick` HTML dans `index.html` (lignes 22 et 39)
- Remplacer ces boutons par un composant React `<AuthButtons />` monté dans `#login-screen`
- Monter ce composant dans `main.js` (comme le `Toast` est déjà monté indépendamment)
- Fichier à créer : `public/src/components/AuthButtons.tsx`

**3b. Nettoyer `hideLoader` dans MainApp.tsx**

- [`public/src/MainApp.tsx:58-60`](public/src/MainApp.tsx#L58-L60) appelle `(window as any).hideLoader()`
- Déplacer `hideLoader()` dans un module TS simple : `public/src/utils/loader.ts`
- L'importer directement dans `MainApp.tsx` et `main.js`

**3c. Nettoyer `insights.js`**

- `insights.js` appelle `window.getAssignedMonthKey`, `window.renderInsightsFeed`, `window.buildBudgetActualMaps`, `window.budgetForMonth`
- Ces fonctions viennent de `app.js` et `budget.js`
- Vérifier si `FinanceQASection` (le composant React QA) utilise encore `insights.js` via le DOM — si non, supprimer `insights.js` entièrement ou convertir ses appels en imports directs depuis les hooks React existants (`useBudget`, etc.)

**3d. Supprimer les panels legacy dans index.html**

- Supprimer le bloc `<div id="legacy-panels">` et tout son contenu
- Supprimer les boutons onclick de l'écran de login (remplacés par `<AuthButtons />`)
- Supprimer `<div id="legacy-mobile-nav">` et `<div id="top-balances">`

**3e. Supprimer `app.js`**

- Après 3a, 3b, 3c, 3d : supprimer `public/src/app.js`
- Retirer son import de `main.js`

---

### Étape 4 — Supprimer budget.js et patrimoine.js

**`patrimoine.js`** — supprimable immédiatement (n'est pas importé dans `main.js`). Vérifier qu'il n'y a aucun import dans le codebase avant de supprimer.

**`budget.js`** — supprimable après l'étape 3 (il était importé par `app.js` seulement).

- Retirer son import de `main.js`
- Supprimer `public/src/budget.js`

---

## Fichiers critiques à modifier

| Fichier                                                                                                                          | Action                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [`public/src/lib/featureFlags.ts`](public/src/lib/featureFlags.ts)                                                               | Hardcoder `BOTTOMNAV_V2: true`                             |
| [`public/src/main.js`](public/src/main.js)                                                                                       | Supprimer branch else + imports legacy                     |
| [`public/src/MainApp.tsx`](public/src/MainApp.tsx)                                                                               | Remplacer `window.hideLoader` par import direct            |
| [`public/index.html`](public/index.html)                                                                                         | Supprimer `#legacy-panels`, onclicks HTML                  |
| [`public/src/components/transactions/TransactionGroupedList.tsx`](public/src/components/transactions/TransactionGroupedList.tsx) | Mettre à jour import `getCatStyle` vers `categoryUtils.ts` |
| **Nouveau** `public/src/utils/categoryUtils.ts`                                                                                  | Migration de `transactions.js` en TypeScript               |
| **Nouveau** `public/src/components/AuthButtons.tsx`                                                                              | Remplacement des onclicks HTML de login                    |
| **Nouveau** `public/src/utils/loader.ts`                                                                                         | Extrait de `hideLoader` depuis `app.js`                    |
| **Supprimer** `public/src/transactions.js`                                                                                       | Après étape 2                                              |
| **Supprimer** `public/src/app.js`                                                                                                | Après étape 3                                              |
| **Supprimer** `public/src/budget.js`                                                                                             | Après étape 4                                              |
| **Supprimer** `public/src/patrimoine.js`                                                                                         | Dès étape 4                                                |
| **Supprimer** `public/src/insights.js`                                                                                           | Après vérification dépendances                             |

---

## Vérification / Tests

Après chaque étape :

1. `npm run build` — zéro erreur TypeScript
2. `npm run lint` — zéro warning ESLint
3. Test en dev (`npm run dev`) : navigation entre toutes les routes fonctionne
4. Test auth : `signInWithGoogle` fonctionne depuis l'écran de login React
5. Test budget : les pages `/budgets/*` affichent correctement les données
6. Test patrimoine : `/patrimoine` charge sans erreur console
7. Vérifier que la console browser ne contient plus de `window.scrollToPanel`, `window.renderBudget` ou appels legacy

---

## Ordre recommandé

```
Étape 1 (flag + main.js)  →  build ✓  →
Étape 2 (transactions.js → TS)  →  build ✓  →
Étape 3a (AuthButtons)  →  build ✓  →
Étape 3b (hideLoader)  →  Étape 3c (insights)  →  Étape 3d (index.html)  →  Étape 3e (delete app.js)  →  build ✓  →
Étape 4 (delete budget.js, patrimoine.js)  →  build ✓
```

Chaque commit intermédiaire doit passer le build pour permettre un rollback propre.
