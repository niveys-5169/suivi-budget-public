# 🏗 Current Architectural State (mise à jour Juillet 2026)

## 🟢 Migrated (React / Premium Aurum V2)

- **Dashboard:** `public/src/components/dashboard/v2/AurumDashboard.tsx` (Complete Orchestrator).
- **Transactions:** `public/src/components/dashboard/v2/AurumTransactionsPage.tsx` (Full React migration).
- **Budget:** `public/src/components/dashboard/v2/AurumBudgetPage.tsx` (With time nav and cascading).
- **Budget Management:** `public/src/components/budgets-v2/BudgetManagerPanel.tsx` + `RAVEditor.tsx` (Inline editing, monthly/annual toggle, category add/remove).
- **Wealth/Patrimoine:** `public/src/components/WealthPage.tsx` (vue canonique, route `/patrimoine` — l'ancienne `AurumWealthPage` et l'entrée `aurum.html` ont été supprimées en juillet 2026).
- **Settings:** `public/src/components/dashboard/v2/AurumSettingsPage.tsx` (Full restoration of legacy config).
- **Formatters:** `public/src/lib/formatters.ts` (Financial logic).
- **Types:** `public/src/types/` (Balances, Banking, Patrimoine).
- **Theme:** AURUM Design System (Dark mode Gold/Ink).

## 🎨 Design System AURUM v3 (juillet 2026)

Refonte complète de l'UI. Source unique : **`public/src/ui/`**
(`tokens.css` + `tokens.ts` + `primitives/`), consommée par les DEUX arbres
d'écrans (`components/` desktop et `mobile/` PWA), qui ne peuvent donc plus
diverger visuellement.

Ce qui a disparu :

- Les **quatre sources de tokens** concurrentes (`@theme` de `tailwind.css`,
  `:root` de `style.css`, `mobile/tokens.css`, `new-ui/theme.ts`) — réduites à
  une. `style.css` passe de 383 à ~100 lignes et ne garde que les classes
  encore référencées par `BalanceHistoryModal`.
- Le module **`components/new-ui/`** (design « JourX », thème clair) et son
  toggle : `useNewUiEnabled`, le flag `newUiEnabled` de `usePreferences`, et les
  deux switchs de `ConfigTab` / `MSettingsModal`.
- Les forks de navigation : `BottomNav`/`MobileBottomNav`,
  `PageHeader`/`MScreenHeader`, `PeriodPills`/`MSegmentedControl`/`Segmented`,
  `MonthNavigator`/`MMonthNavigator`. Un seul rendu chacun.
- La **triple application** de `premium-container` (le wrapper de route plus
  cinq écrans), qui doublait marge et largeur maximale.

Bugs latents corrigés au passage :

- `utils/categoryUtils.ts` lisait `var(--cat-red|blue|…)`, variables déclarées
  dans aucune feuille de style vivante — toutes les couleurs de catégorie se
  résolvaient à vide.
- Le token `--font-serif` nommait `Fraunces`, jamais chargée ; le rendu ne
  tenait que par un `!important` dans `style.css`.
- `finance-qa.css` (158 lignes) n'était importé nulle part.

Garde-fou : **`scripts/check-design-system.mjs`** remplace
`check-arbitrary-radius.mjs` (saturé à 105/105). Dix compteurs à cliquet,
branchés sur la CI et le pre-commit. Voir `DESIGN_SYSTEM.md` § 4.

## 🟡 In Progress / Refinement

- **Charts:** Performance optimization for large historical datasets.
- **Sync:** Fine-tuning GitHub Action dispatch feedback.

> **Note (Juillet 2026) :** les sections "Legacy JS", "HTML Panels", "Mirrors"
> et les casts `any` de `BudgetDashboard`/`BudgetKPIs` autrefois listés ici
> décrivaient un état déjà résolu (aucun `.js` legacy dans `public/src/`,
> aucun panneau HTML hors `index.html`, `Suivi-Budget-mirror/`
> supprimé du dépôt) — retirées pour ne plus pointer les relecteurs vers des
> non-problèmes.

## 🆕 Nouveaux utilitaires (Sprint 2 & 3 — Mai 2026)

### Accessibilité (Sprint 2.1)

- **`public/src/hooks/useFocusTrap.ts`** — Piège le focus Tab/Shift+Tab dans un dialog. Restaure le focus sur l'élément déclencheur à la fermeture.
- **`public/src/components/shared/Modal.tsx`** — Composant modal WCAG AA : `role="dialog"`, `aria-modal`, `aria-labelledby`, gestion Escape, backdrop click. Remplace le pattern portal ad-hoc de `TransactionFormModal`.

### Robustesse Firestore (Sprint 2.2)

- **`public/src/lib/toast.ts`** — Wrapper typé sur le système `CustomEvent`-based existant. API : `toast.success / .error / .info / .loading / .dismiss` (les variantes `success`/`error`/`info` acceptent un `id` optionnel pour la déduplication).
- **`public/src/utils/firestoreError.ts`** — Mappe 14 codes d'erreur Firebase vers des messages français. Expose `isRetryable()` pour distinguer erreurs transitoires/fatales.
- **`public/src/utils/withRetry.ts`** — Enveloppe async avec backoff exponentiel (3 tentatives, 500 → 1000 → 2000 ms). Bypass pour les erreurs non-retryables.

### Performance (Sprint 1.2)

- **Bundle analyzer** — `rollup-plugin-visualizer` activé via `ANALYZE=true`. Script : `npm run analyze` → `dist/stats.html`.
- **Lazy routes** — `TransactionsSection`, `BudgetsV2Section`, `FinanceQASection`, `AdvancedSettings` et toutes les sous-pages avancées sont maintenant code-splittés dans `MainApp.tsx`.

### Tests & Storybook (Sprint 3.2)

- **`.storybook/`** — Storybook 8 (Vite) avec `addon-essentials`, `addon-a11y`, `addon-interactions`. Stories disponibles : `Modal`, `PageHeader`, `MonthNavigator`.
- **`tests/utils/`** — Tests unitaires Vitest pour `firestoreError.ts` (14 assertions), `withRetry.ts` (retry + backoff), `toast.ts`.

## 🌉 Legacy `window.*` bridges — ✅ supprimés (Juin 2026)

Le backlog de bridges est soldé. Audit Juin 2026 : les modules legacy
(`budget.js`, `patrimoine.js`, `transactions.js`, `categories.js`) ayant déjà
disparu du bundle, **plus aucun bridge n'avait d'écrivain** — les lecteurs
React tombaient silencieusement sur leurs fallbacks. Tous ont été retirés :

- `window.appState` / `setAppState` / `patchAppState` / `FSCache` — exposition supprimée de `store.js` (zéro lecteur) ; le mirror `ACCOUNT_BALANCES` de `GlobalDataContext` a été retiré. L'état global passe par le store module (`import { state } from './store'`) et les contexts React.
- `window.ALL_TX` — n'existait plus qu'en déclaration ; tout le code utilise `state.ALL_TX` (store module).
- `window.CATEGORIES` — branches mortes supprimées de `budgetHelpers.isIncomeBudget` / `getBudgetedMonthlyIncome` (la détection revenus repose sur `isIncome`, `type === 'revenu'` et l'auto-détection transactionnelle) ; `BudgetManagerPanel` réutilise `isIncomeBudget`.
- `window.AnnualBudgetLogic` — déjà disparu (aucun appelant).
- `window.getCatStyle` / `window.formatLibelle` — `RecentOperations` importe désormais directement `utils/categoryUtils`.
- `window.hideLoader` / `setLoaderMsg` — exposition supprimée de `utils/loader.ts` ; tous les appelants (y compris `Dashboard.tsx`) utilisent l'import direct.
- Panneaux legacy (`submitReparseJob`, `refreshTransactionsFromEmails`, `detectDuplicatePairs`, `openDuplicatesModal`) — jamais définis : les boutons étaient des no-ops silencieux. `AdvancedSettings` affiche désormais un toast explicite ; l'insight doublons de `InsightsFeed` navigue vers `/transactions`. `getGitHubSettings` / `saveGitHubSettings` étaient déjà migrés (`services/firebase-api.ts`).

`public/src/types/globals.d.ts` ne contient plus que la déclaration du module
virtuel `virtual:pwa-register/react`. Expositions window restantes (hors scope
bridge, internes à `main.js`) : `window.FLAGS`, `window.reactRoots`.

## 🔁 Récurrences unifiées, mensuel uniquement (Juillet 2026)

Les deux systèmes de récurrences historiques (`recurrences` déterministe et
`recurring_expense_settings` heuristique) ont été fusionnés en un seul modèle
(`docs/plans/2026-07-02-recurrences-unified-design.md`). Un premier jet
supportait plusieurs fréquences (hebdo/trimestriel/annuel) et un système de
suggestions détectées automatiquement ; l'usage réel de l'app étant
exclusivement mensuel, les deux ont été retirés pour un modèle plus simple.
État final :

- **Moteur pur** — `public/src/utils/recurrenceEngine.ts` : `matchTransaction`
  (catégorie identique **toujours éliminatoire**, jamais un simple bonus de
  score), `computePeriodState`, `getLinkCandidates`, `getUpcomingOccurrences`,
  `getExpectedDate`, `getDayOfMonth`, `normalizeLabel`, `getRecurringKey`.
  Mensuel uniquement — pas de champ `frequency`. `dayOfMonth` reste un champ
  **optionnel** de compat pour les documents créés avant l'introduction
  d'`anchorDate` — plus aucune écriture double.
- **Pas de suggestions détectées** — l'app ne propose plus de créer
  automatiquement des récurrences à partir de l'historique. Seule la
  suggestion de rattachement d'une transaction à une récurrence existante
  (au moment de la liaison, via `matchTransaction`) subsiste.
- **UI simplifiée à 2 catégories** — `AurumRecurringPage` / `AnalyseScreen`
  (mobile) n'affichent que « En attente » (candidats à approuver + paiements
  attendus, fusionnés) et « Payé ce mois ». Les récurrences en pause restent
  gérables (bouton pause/reprise) mais ne forment plus de section dédiée —
  elles sortent simplement de « En attente », marquées d'un badge discret.
- **Consommateurs** — RAV (`ravCalculations.ts`), prévisionnel
  (`useCashflowForecast.tsx`), alertes (`useAlerts`/`computeAlerts`) et l'UI
  (badges transactions desktop/mobile) lisent tous `recurrences` (source
  unique).

## 🎯 Façade unique des récurrences (juillet 2026)

La fusion de juillet avait unifié les **données** mais laissé **deux pipelines
de lecture** concurrents au-dessus : `utils/recurrenceProcessing` (statuts
`paid|to_approve|expected|skipped`, utilisé par `/recurring` et le mobile) et
`utils/analyseAggregations.enrichRecurrences` (états `paid|pending|overdue|
skipped` et modèle de vue `RecurringItemEnriched`, utilisé par l'onglet
Analyse). Une transaction appariée mais non approuvée était donc affichée
« En attente » sur un écran et « Réalisée » sur l'autre, au même instant.

État final :

- **Un seul automate** — `recurrenceEngine.RecurrenceState` :
  `approved | matched | skipped | expected | overdue`. `approved` (validé par
  l'utilisateur) et `matched` (suggestion du matcher) sont distincts, mais les
  deux signifient que l'argent est sorti : `isSettled()` porte cet axe, utilisé
  par le RAV pour ne pas re-provisionner une dépense déjà constatée.
  `needsAction()` porte l'axe « demande une action ».
- **Une seule façade** — `hooks/useRecurrences.ts` : sélecteurs (`items`,
  `expenses`, `incomes`, `byState`, `totals`, `mappings`, `linkCandidates`) et
  commandes (`approve`, `unapprove`, `link`, `unlink`, `skip`, `unskip`,
  `edit`, `remove`, `setActive`). Toute surface passe par elle ; plus aucun
  écran n'appelle `recurrencesService` ni `recurrenceEngine` directement.
  Elle centralise les effets de bord auparavant partiels : apprentissage de
  l'alias **à chaque** approbation (et non plus depuis `/recurring` seulement),
  pointage de la transaction à chaque liaison, une seule écriture Firestore sur
  « Rétablir »/« Délier », règle de mois unique (`moisAffectation || date`), et
  garantie qu'une transaction n'est jamais revendiquée par deux récurrences.
- **Une seule interface de gestion** — `/recurring` (`AurumRecurringPage`) et
  son miroir mobile (`AnalyseScreen`). L'onglet Analyse › Récurrences est
  passé en **lecture seule** : agrégats et liste par état, toute action renvoie
  vers `/recurring`.
  _(Remplacé en août 2026 — voir § « Récurrences : un seul écran » ci-dessous ;
  `AnalyseScreen` n'a plus de mode récurrences.)_
- **Revenus visibles partout** — le filtre `expectedAmount < 0` du desktop
  masquait les récurrences de revenus, que le mobile affichait. `/recurring` a
  désormais une section « Revenus » avec son propre total.
- **Décommissionné** — `utils/recurrenceProcessing.ts`, `utils/matchRecurrence.ts`,
  `hooks/useRecurrenceReconciliation.ts`, `analyseAggregations.enrichRecurrences`
  et le type `RecurringItemEnriched` supprimés, ainsi que les trois barèmes
  ad-hoc de sélection des candidats au rattachement (remplacés par
  `getLinkCandidates`) et l'UI morte de l'ancien modèle heuristique
  (boutons Valider/Ignorer/Fusionner câblés sur `() => {}` et jamais rendus).
- **Backend Python inchangé** — `src/ai_categorizer.is_likely_recurrence` reste
  un matcher distinct : à l'import la catégorie de la transaction est encore
  vide, il ne peut donc pas appliquer la règle « catégorie éliminatoire ».
- **Décommissionné** — `useRecurring`, `hooks/recurringService.ts`,
  `utils/detectRecurringCandidates.ts`, `utils/detectRecurrenceSuggestions.ts`,
  `hooks/useRecurrences.ts`, le type `RecurringExpense`, `recurringSettings`
  et `ignoredSuggestionKeys` de `GlobalDataContext` ont été supprimés. La
  collection `recurring_expense_settings` est gelée en lecture seule
  (`firestore.rules`) après migration des documents `accepted`/`rejected`
  vers `recurrences` / `ignoredKeys` (`scripts/migrate_recurring_settings.py`,
  backup horodaté conservé). Suppression définitive de la collection
  différée après un mois d'observation.

## 🔁 Récurrences : un seul écran, matching assoupli (août 2026)

Deux signalements distincts : des liaisons évidentes que le matcher refusait
de proposer, et deux interfaces de gestion (`/recurring` d'un côté, l'onglet
Analyse › Récurrences — actionnable en PWA, lecture seule sur desktop — de
l'autre) qui n'étaient ni identiques ni complémentaires.

**Matching** (`utils/recurrenceEngine.ts`) :

- `matchTransaction` — la règle « catégorie toujours éliminatoire »
  (§ « Récurrences unifiées » ci-dessus) ne s'applique plus qu'au chemin
  **sans alias**. Un libellé déjà appris (`rec.aliases`) suffit désormais à
  proposer la liaison même si la transaction est mal catégorisée ou pas
  catégorisée du tout — c'est justement le cas que ce chemin doit couvrir.
  Le signe (`Math.sign`) doit en revanche toujours concorder, sur les deux
  chemins : c'est le garde-fou qui remplace la catégorie sur le chemin fort.
- `DAY_WINDOW` passe de 4 à 7 jours (chemin sans alias) — un week-end plus un
  jour férié décale un prélèvement de plus de 4 jours.
- `getLinkCandidates` (rattachement manuel) gagne un terme de proximité de
  date et un malus (non éliminatoire) de signe opposé ; limite par défaut
  20 → 50.
- `hooks/useRecurrences.ts` : le calcul des états parcourt désormais les
  récurrences actives en **deux passes** (alias d'abord, coïncidences de
  montant ensuite) pour qu'une récurrence triée plus tôt dans le mois ne
  puisse plus voler par erreur la transaction d'une autre reconnue par son
  alias. Le vivier du rattachement manuel (`linkCandidates`) s'étend au mois
  affiché ± 1, contre le seul mois affiché auparavant. `link()` catégorise
  désormais la transaction liée si elle ne l'était pas (avec la catégorie de
  la récurrence) — contrepartie nécessaire de l'assouplissement : le RAV ne
  provisionne que les catégories de dépense déclarées.

**Interface** : `/recurring` (`AurumRecurringPage`) est maintenant l'unique
écran de gestion, desktop **et** PWA — routable dans `MobileSwipeContainer`
(chargement à la demande, `React.lazy`), accessible depuis la sidebar
desktop et une carte dédiée sur `HomeScreen` (PWA). Elle gagne le
rattachement manuel (`components/shared/LinkRecurrenceModal.tsx`, déplacé
depuis `mobile/components/MLinkRecurrenceModal.tsx`) et le déliage par
entrée. **Décommissionné** : l'onglet Analyse › Récurrences (desktop —
`AnalyseRecurrencesPanel.tsx`, `drilldowns/RecurringDrillDown.tsx`) et le mode
« Récurrences » de l'écran Analyse mobile (`MSegmentedControl`).

## 🔗 Infrastructure

- **Python Functions:** Manage ingestion and reconciliation (`functions/`).
- **Bridge:** Google Apps Script (`Code.gs`) handles the connection between Google Sheets and Firestore.
- **Hooks:** React hooks for each domain (`useBudget`, `usePatrimoine`, `useAdvancedSettings`, etc.).
