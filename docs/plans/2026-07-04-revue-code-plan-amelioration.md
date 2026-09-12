# Plan d'amélioration Suivi-Budget — revue complète de code

## Contexte

Revue complète du dépôt (frontend React/TS dans `public/src/` ~45 000 lignes, backend Python dans `src/` + `functions/`, infra Firebase/CI). Trois audits parallèles (frontend, backend, infra/sécurité) ont identifié des bugs réels, une duplication majeure de code backend, des dettes de configuration et ~25 Mo de fichiers parasites committés.

**Objectif** : corriger et améliorer par phases **indépendantes et interruptibles**. Chaque phase = une branche/PR autonome, tests verts avant et après, aucune phase ne dépend d'une phase ultérieure. On peut s'arrêter après n'importe quelle phase sans laisser le dépôt dans un état intermédiaire.

**Règle de reprise** : avant de commencer une phase, vérifier `git log` sur `main` pour voir quelles phases sont déjà mergées (chaque commit de phase est préfixé `phase-N:`). Chaque phase liste ses critères de vérification — les exécuter avant de merger.

**Contrainte de branche (ajustement 2026-07-04)** : toutes les phases de ce chantier s'empilent en commits successifs sur l'unique branche `claude/code-review-improvements-bv0xwl` (PR #676), pas une branche par phase — contrainte imposée par l'environnement d'exécution. La logique « phases indépendantes et interruptibles » reste valable au niveau des commits : chaque phase = un groupe de commits atomiques, revenables individuellement (`git revert`).

---

## Phase 1 — Bugs de correction (critique, ~1 session) — ✅ FAIT (2026-07-04)

Bugs vérifiés dans le code, à corriger en premier car ils affectent des données financières affichées.

1. **Staleness consommation budgets** — `public/src/components/budgets-v2/BudgetsPage.tsx:93-137` : le `useMemo` lit le singleton mutable `state.ALL_TX` (lignes 102, 126) mais son tableau de dépendances (ligne 137) ne contient aucune donnée transaction. Si les transactions arrivent après les budgets, la consommation reste calculée sur un tableau vide/périmé. **Fix** : consommer les transactions via `useTransactionContext()` (elles y sont déjà, `TransactionContext.tsx` les mirror dans `state.ALL_TX` ligne 125) et les ajouter aux deps. Retirer les `console.log` lignes 98 et 135 au passage.
2. **`GlobalDataContext` loading cassé** — `public/src/context/GlobalDataContext.tsx:114` : `setLoading(false)` est appelé de façon synchrone juste après l'enregistrement des 6 `onSnapshot`, avant toute donnée. **Fix** : passer `loading` à `false` seulement quand les snapshots initiaux sont arrivés (compteur ou `Promise.all` de premiers snapshots). Ajouter un **callback d'erreur** aux 6 listeners (lignes 61-112) via `utils/firestoreError.ts` + `lib/toast.ts` existants.
3. **`export_firestore.py` cassé** — le fichier contient littéralement `cat > ... << 'EOF'` en ligne 1 (heredoc shell collé comme contenu). Extraire le vrai contenu Python (entre les marqueurs EOF) ou supprimer le fichier s'il est obsolète.
4. **Timezones naïves backend** — `src/transaction_parser.py:83` (`datetime.now()` naïf pour la fenêtre d'acceptation ±730j/30j) et `src/importer.py:233` (`fromtimestamp` sans `tz=`, alors que la ligne 86 du même fichier le fait correctement). Aligner sur `datetime.now(timezone.utc)` comme le reste du code.
5. **Groupement par jour dépendant du fuseau (frontend)** — `AurumTransactionsPage.tsx:60` et `AurumRecentTransactions.tsx:30` utilisent `new Date(tx.date).toISOString().split('T')[0]` (décalage d'un jour possible). Utiliser l'approche string (`.slice(0, 10)` / helper `getAssignedMonthKey` de `utils/date.ts:63`).
6. **Exception avalée** — `functions/main.py:180-183` : `except Exception: pass` sur l'étiquetage Gmail → risque de retraitement silencieux d'emails. Remplacer par `logging.exception` au minimum.

**Vérification** : `npm test`, `npm run typecheck`, `npm run lint`, `pytest`. Manuel : charger la page Budgets et vérifier que la consommation se met à jour à l'arrivée des transactions (throttle réseau pour simuler l'ordre inverse).

**Statut** : PR #676 ouverte, 7 commits, tests/lint/typecheck verts. `main` a avancé entre-temps (chantier « récurrences unifiées », PR #675 et suivantes fusionnées) et introduit **1 conflit réel** (vérifié via `git merge-tree --write-tree`, moteur ORT) : `public/src/context/GlobalDataContext.tsx` — main a supprimé les listeners `recurringSettings`/`ignoredSuggestionKeys` (décommissionnés) et simplifié `setLoading(false)` en appel inconditionnel, ce qui recoupe directement notre fix de loading différé. `AurumTransactionsPage.tsx` est touché des deux côtés mais s'auto-merge proprement (pas de conflit réel).

---

## Phase 1.5 — Résoudre le conflit de merge avant la Phase 2 — ✅ FAIT (2026-07-04)

1. `git fetch origin main && git merge origin/main` sur `claude/code-review-improvements-bv0xwl`.
2. Résoudre `GlobalDataContext.tsx` : garder l'esprit du fix Phase 1 (loading ne repasse à `false` qu'après le premier snapshot/erreur de **chaque source active**) mais adapté aux **4 listeners restants** après décommission (`accountBalances`, `ownerMapping`, `ravConfig`, `recurrences` — supprimer `recurringSettings`/`ignoredSuggestionKeys` du `SOURCE_COUNT` et des callbacks `markReady`/`onError`, qui n'existent plus côté main). Pas d'action sur `AurumTransactionsPage.tsx` (auto-merge propre).
3. Committer le merge (`git commit` sans `--no-edit` custom nécessaire, message par défaut de merge acceptable).
4. Revérifier : `npm test`, `npm run typecheck`, `npm run lint`, `pytest` — puis `git push origin claude/code-review-improvements-bv0xwl`.

---

## Phase 2 — Hygiène du dépôt (sans risque fonctionnel, ~1 session) — ✅ FAIT (2026-07-04)

Aucun changement de comportement — uniquement suppression de poids mort. Chaque étape est un commit séparé sur la même branche `claude/code-review-improvements-bv0xwl` (pas de nouvelle branche — contrainte d'exécution). Vérifications faites le 2026-07-04 : toutes les cibles ci-dessous existent encore et sont trackées telles que décrites.

### Commit 1 — untracker `.playwright-mcp/`

```bash
git rm -r --cached .playwright-mcp/
```

Le `.gitignore` (ligne 41) couvre déjà le chemin — pas de modif `.gitignore` pour cette étape.

### Commit 2 — supprimer l'outillage MCP vendoré + l'artefact mirror errant

```bash
git rm -r Suivi-Budget-mirror/ fetch-mcp/ playwright-mcp-server/ github-mcp-server/
```

`Suivi-Budget-mirror/info/exclude` est un **fichier normal** (mode 100644, vérifié via `git ls-files -s`, pas un gitlink/submodule 160000) — contenu = template git par défaut, aucune règle réelle. `github-mcp-server/` : le seul fichier tracké est le binaire `.exe` (21 Mo) lui-même, pas un fichier annexe.
Puis :

- Ajouter à `.gitignore` (après la ligne 41) : `Suivi-Budget-mirror/`, `fetch-mcp/`, `playwright-mcp-server/`, `github-mcp-server/`.
- Retirer les entrées désormais mortes dans `eslint.config.js` (`ignores`, lignes 19, 22-24), `.prettierignore` (lignes 12, 14-16), `.geminiignore` (ligne 4).

**Limite connue** : le blob de 21 Mo restera dans les packfiles git tant que l'historique n'est pas réécrit (BFG/filter-repo) — hors périmètre ici (casserait les SHA de la PR ouverte, nécessiterait un force-push). À noter comme suivi pour une phase dédiée si la taille du dépôt devient gênante.

### Commit 3 — supprimer le codemod mort

```bash
git rm fix-eslint.cjs
```

(vérifié : aucune référence dans `package.json` ni `.github/`)

### Commit 4 — supprimer les stubs `.gs` vides

```bash
git rm src/gmail.gs src/main.gs src/sheets.gs src/utils.gs
```

Non référencés par `appsscript.json` (racine ni `src/`) — le vrai code Apps Script vit dans `archive/google-apps-script/`. Aucune modif d'`appsscript.json` nécessaire.

### Commit 5 — déplacer les .md de travail vers `docs/history/`

```bash
git mv AUDIT_REPORT.md PATRIMOINE_FIX_INSTRUCTIONS.md BANKIN_MIGRATION_START_HERE.md \
       implementer-prompt.md 2026-05-20-refonte-ui-transactions.md docs/history/
```

Noms conservés tels quels : la convention `YYYY-MM-DD-slug.md` n'est respectée que par 1/7 fichiers existants dans `docs/history/` — pas de renommage rétroactif arbitraire. Vérifier avant déplacement qu'aucun lien relatif ne pointe vers ces fichiers (`grep -rln` sur les noms, hors `node_modules`/`.git`).

### Commit 6 — dépendances : retirer le devDependency MCP, aligner `react-is`

Dans `package.json` :

- retirer `"@executeautomation/playwright-mcp-server": "^1.0.12"` (devDependencies) — vérifié : aucune référence dans les scripts npm, CI, vite/storybook config.
- `"react-is": "^19.2.7"` → `"react-is": "^18.3.1"` — vérifié : aucun import direct dans `public/src`/`src`, seulement requis en transitif (peer de `recharts`, qui accepte `^16-19.x` mais dont la propre devDependency pointe déjà `^18.3.1`) ; `18.3.1` existe bien sur le registre npm.
- **Ne pas toucher** au bloc `overrides` existant : vérifié qu'il ne concerne pas les serveurs MCP retirés (ce sont des pins sécurité transitifs sans rapport — `@modelcontextprotocol/sdk`, `uuid`, `undici`, `ai`, etc.). `lucide-react@1.23.0` confirmé légitime (`npm view lucide-react dist-tags` → latest 1.23.0, lockfile intègre) — aucune action.

```bash
npm install   # régénère package-lock.json (le manifest change, pas npm ci)
git diff --stat package-lock.json   # vérifier que seuls react-is et @executeautomation/* bougent significativement
```

### Commit 7 — documenter `.env.premium`

Décision retenue : garder tracké tel quel (5 flags booléens `VITE_*`, consommés par `public/src/lib/featureFlags.ts`, aucun secret malgré le nom `.env.*`). Ajouter dans `.gitignore` juste après les règles `.env`/`.env.*` :

```gitignore
# .env.premium est un fichier de flags publics (VITE_*), sans secret,
# volontairement suivi par git malgré le pattern .env.* ci-dessus.
!.env.premium
```

### Vérification finale (avant push, dans cet ordre)

```bash
npm ci
npm run typecheck && npm run lint && npm run format:check
npm test
npm run build && npm run build:premium   # build:premium exerce .env.premium (commit 7)
pytest   # garde-fou, non touché par cette phase
git count-objects -vH   # informationnel — ne baissera pas tant que l'historique n'est pas réécrit (cf. commit 2)
git push origin claude/code-review-improvements-bv0xwl
```

---

## Phase 3 — Dépendances et documentation (~1 session) — ✅ FAIT (2026-07-04)

1. **Réconcilier `requirements.txt` (racine) et `functions/requirements.txt`** : conflits vérifiés — `requests` 2.34.2 vs 2.33.0, `beautifulsoup4` 4.15.0 vs 4.14.3, `firebase-admin` `==7.4.0` vs `>=7.4.0`. Adopter une stratégie unique (pins exacts), vérifier que chaque pin résout sur PyPI, reporter les correctifs sécurité notés côté functions vers la racine.
2. **Docs à jour** : corriger `CLAUDE.md`/`GEMINI.md` qui pointent `src/types/`, `src/hooks/` alors que le frontend est dans `public/src/` ; rafraîchir `docs/ARCH_STATE.md` (la section "Legacy JS à supprimer" décrit un état déjà terminé — plus aucun `.js` legacy n'existe ; les casts `any` mentionnés ont disparu).
3. **Config Firebase dupliquée** : le même config (avec clés Web) vit dans `public/src/services/firebase.ts` et `public/src/firebase-setup.ts` — garder une seule source.

**Vérification** : `pip install -r requirements.txt` et `-r functions/requirements.txt` dans des venvs propres ; `pytest` ; `npm run build`.

---

## Phase 4 — Déduplication backend `src/` ↔ `functions/` — ✅ FAIT (2026-07-04, approche « garde-fou »)

**Décision d'exécution.** L'exploration a invalidé l'approche « package partagé » initialement envisagée : `firebase.json` déploie `functions/` **tel quel** (un package à la racine ne serait pas embarqué), les imports sont **plats/absolus** (`from firebase_db import …`, résolus par le `sys.path` du contexte d'exécution), et surtout `firebase_db.py` **diverge par conception** — 14 des 15 fonctions communes ont des corps différents, à commencer par `_get_db()` (init depuis `FIREBASE_CREDENTIALS` côté `src/` vs client fourni par le runtime côté `functions/`). Forcer une copie unique **casserait** soit le déploiement, soit les importeurs CI. Le déploiement Firebase et les importeurs planifiés n'étant pas testables ici, l'unification physique complète a été écartée au profit d'une approche sûre, sans aucun changement du déploiement ni des imports.

Réalisé :

1. **`gmail_client.py` unifié** en superset byte-identique (union des méthodes ; divergences cosmétiques/additives seulement — `get_message_html` retient la version `src/` qui ajoute `subject`). Les deux copies sont désormais identiques.
2. **Garde-fou anti-dérive** (`tests/test_shared_backend_sync.py`) : échoue si l'une des 6 copies censées identiques (`ai_categorizer`, `ai_lexical`, `ai_rag`, `balance_coherence`, `transaction_parser`, `gmail_client`) diverge entre `src/` et `functions/`. Tue le risque de divergence silencieuse. Un second test fige le fait que `firebase_db.py` diverge volontairement.
3. **`firebase_db.py`** : divergence documentée par une note d'en-tête croisée dans les deux fichiers (pourquoi ils ne doivent PAS être fusionnés). **Non unifié** — c'est le bon comportement.
4. **Mismatch tests/prod corrigé** (`tests/test_src_firebase_db_smoke.py`) : la suite chargeait `functions/firebase_db.py`, laissant les 26 fonctions propres à `src/` (exécutées en prod côté CI) sans test. Le smoke test charge explicitement `src/firebase_db.py` (nom de module isolé) et vérifie import propre + présence de la surface publique.

**Non fait (volontairement, hors périmètre sûr)** : suppression physique des copies, package partagé + vendoring au déploiement, shim `functions/src/firebase_db.py`. À reprendre seulement si l'on accepte de piloter à la main le premier déploiement réel.

**Vérification** : `pytest` → 186 passés (33 nouveaux), 1 échec préexistant environnemental (`test_poll_imports_without_history_cursor`, présent aussi sur `main`).

---

## Phase 5 — Cohérence frontend — ✅ PARTIE CHIRURGICALE FAITE (2026-07-04)

Améliorations mécaniques, faible risque, découpables en commits indépendants :

1. **Formatage monétaire** : router tous les `toLocaleString('fr-FR', { currency: 'EUR' })` inline vers `lib/formatters.ts:formatCurrency` (cache `Intl.NumberFormat` existant). Sites connus : `WealthTotalCard.tsx:75`, `BudgetHeaderSummary.tsx:29-60`, `financeQAAnalysis.ts:302`. Supprimer les deux `formatCurrency` locaux dupliqués et l'import mort dans `TransactionGroupedList.tsx` (lignes 9, 57, 284).
2. **Dates** : fusionner `utils/date.ts` et `utils/firestoreDate.ts` en un convertisseur canonique Timestamp/seconds/string/Date ; remplacer les groupements `new Date(...).toISOString()` restants par les helpers string.
3. **`alert()`/`confirm()` → toast + dialog accessible** : 10 `alert` (`AurumRecurringPage.tsx:117-179`, `HistoryManagementModal.tsx:209`) et 12 `confirm`. Le composant `shared/Modal.tsx` (WCAG) existe déjà — créer un petit `ConfirmDialog` dessus.
4. **Logs de debug** : retirer les `console.log` des chemins de rendu (`BudgetContext.tsx:192`, `usePortfolio.tsx:211,358`, `useDashboard.tsx:85`, `featureFlags.ts:51,72`, `main.ts:24` — ceux de BudgetsPage sont traités en Phase 1) ; introduire un mini-logger gated dev branché sur `lib/sentry.ts` pour les `console.error` utiles.
5. **Robustesse écritures Firestore** : appliquer `withRetry` + `firestoreError` (déjà écrits) aux `setDoc`/`deleteDoc`/`writeBatch` directs des pages avancées, patrimoine/placements et modals d'historique — même pattern que `BudgetContext.tsx:207,236,269`.
6. **Constante propriétaires** : dédupliquer les 3 littéraux `['Nicolas','Romane']` / `default_owner:'Nicolas'` de `GlobalDataContext.tsx` en une constante.

**Vérification** : `npm test` (dont tests a11y jest-axe existants), `npm run lint`, `npm run typecheck` ; smoke manuel des flux modifiés (suppression récurrence, gestion historique).

---

## Phase 6 — Durcissement TS FAIT / retrait singleton ✅ FAIT (2026-07-06)

Dépend de la Phase 1 (le principal lecteur de `state.ALL_TX` avait déjà migré).

1. ✅ **Lecteurs migrés vers `useTransactions()`** : `BudgetManagerPanel`, `BudgetFormModal`, `BudgetDetailModal`, `RAVEditor` (retrait du fallback singleton, ils recevaient déjà les transactions du contexte). Le 5ᵉ lecteur non listé initialement — `getBudgetedMonthlyIncome` (`utils/budgetHelpers.ts`) — prend désormais `transactions` en paramètre, injecté par ses deux appelants dans `AurumBudgetPage.tsx` (déjà sous provider). Tous les casts `as Transaction[]` supprimés.
2. ✅ **Mirror + bus supprimés** : retrait de `state.ALL_TX = txData` et du `CustomEvent('budget-data-updated')` dans `TransactionContext.tsx`. `useSyncTransactions` a migré du bus vers `useTransactionContext().transactions` + un effet de surveillance post-import (le `previousCount` et les écarts de solde sont réévalués à chaque nouveau snapshot au lieu d'écouter l'événement). Les 4 dispatches devenus morts de `BudgetManagerPanel` retirés (plus aucun écouteur). Champ `ALL_TX` supprimé de `store.ts`/`store.d.ts`. Test `useSyncTransactions.test.tsx` réécrit pour piloter via le contexte ; mocks `store` morts retirés des tests a11y.
3. **DIFFÉRÉ** — Unifier le contrat de `useGlobalData` (lever hors provider au lieu de défauts silencieux). Non fait : hors périmètre du retrait du singleton, à traiter séparément.
4. ✅ **tsconfig durci** (fait sur la PR précédente) : `allowJs` retiré, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noImplicitReturns`, `noFallthroughCasesInSwitch` activés.

**Vérification (2026-07-06)** : `npm run typecheck` zéro erreur, `npm run lint` (1 warning préexistant hors périmètre, `BudgetsPage.tsx:189`), `npm test` → 651 tests verts, `npm run build` OK.

---

## Phase 7 — PARTIE CHIRURGICALE FAITE / infra tests DIFFÉRÉE (2026-07-04)

1. **Tests des règles Firestore** : `firestore.rules` est riche (default-deny, email_verified, claims admin, `hasOnly` sur champs) mais jamais testé. Ajouter `@firebase/rules-unit-testing` + émulateur en CI. Corriger au passage : bloc dupliqué `users/{uid}/ai_sessions` (lignes 100-102 vs 135-137), `placement_history` dont le "append-only" n'est pas réellement contraint, `placements` delete sans validation.
2. **CI** : activer le job CodeQL commenté dans `security.yml:83-116` ; faire tourner `e2e.yml` sur PR (au moins le smoke) et non seulement en cron hebdo ; ajouter un bloc `permissions:` least-privilege à `deploy-functions.yml` ; réévaluer le grant `allUsers → roles/run.invoker` sur les 3 services Cloud Run.
3. **Couverture** : ajouter provider + seuils de couverture à `vitest.config.ts` et `--cov` à pytest, remontés en CI (seuils initiaux = niveau courant, non bloquants au début).
4. **Tests backend manquants** : `src/importer.py`, `eb_importer.py`, `tronity_client.py`, `auto_categorize_backend.py`, `history_importer.py` (chemins d'ingestion d'argent réel, non testés).
5. **Périmètre Firebase** : les clés Web sont publiques par design mais toute la sécurité repose sur Auth + règles. Ajouter des restrictions de clé API (referrer HTTP) dans la console GCP. L'isolation par utilisateur des collections (`budgets`, `transactions`, `placements`…) est un choix assumé mono-utilisateur — documenté dans les règles ; ne pas la changer sauf demande explicite.

**Vérification** : CI verte sur une PR de test ; tests règles passant contre l'émulateur ; rapport de couverture publié.

---

## Phase 8 — EN COURS (refactors larges + optim. spéculative)

À faire en dernier, bénéfice UX incrémental. Approche prudente : chaque item est découpé en extractions **pures** (zéro changement de comportement), vérifiées par typecheck + tests avant/après.

1. ✅ **Virtualisation des listes** (2026-07-06, Option A) : `React.memo` déjà en place ; le coût de rendu hors écran est désormais borné par `content-visibility: auto` + `contain-intrinsic-size: auto 400px` sur les **conteneurs de lignes** des deux listes (`dashboard/TransactionList.tsx`, `transactions/TransactionGroupedList.tsx`) — les headers sticky restent hors du sous-arbre contenu. Dégradation gracieuse (propriété ignorée si non supportée). **Validé en vrai Chromium** via un harnais Playwright répliquant la structure sticky + content-visibility : contenu lointain skippé (`checkVisibility`), sticky à `top: 0`, dérive de hauteur 0,9 % puis idempotente. Limite : validé sur structure répliquée, pas sur l'app connectée (auth Firebase indisponible en CI) — un contrôle visuel humain sur l'app réelle reste souhaitable. L'Option B (`@tanstack/react-virtual`, démontage réel) reste documentée ci-dessous si l'Option A s'avère insuffisante sur très gros volume.
2. **Découpage des gros fichiers** — extraire la logique d'agrégation/mutation vers `utils/`/`services/` (pattern : `utils/analyseAggregations.ts`).
   - ✅ **`AnalyseSection.tsx`** (2026-07-06, 616 → 559 l.) : logique pure extraite vers `analyseAggregations.ts` — `computeCategoryGroups` (ventilation par onglet + totaux entrées/sorties/visible), `computeIncomeBudget`, `computeSpentInBudget`, `isBudgetInCalculationScope` (déduplique le prédicat actif+périmètre). 10 tests unitaires ajoutés. Zéro changement de comportement.
   - ✅ **`WealthPage.tsx`** (2026-07-06, 580 → 523 l.) : construction de la liste d'actifs extraite vers `utils/wealthSnapshot.ts` — `resolveAssetOwner` (résolution propriétaire : explicite → mapping → motif épargne → défaut) et `buildSnapshotOptions` (fusion comptes/épargne/placements + dédoublonnage par id). 10 tests unitaires ajoutés. Zéro changement de comportement.
   - ✅ **`AurumRecurringPage.tsx`** (2026-07-06, 498 → 453 l.) : traitement des récurrences extrait vers `utils/recurrenceProcessing.ts` — `processRecurrences` (classement payé/ignoré/à approuver/attendu), `sortRecurrences`, `getRecurrenceDisplayAmount`, `computeRecurringMonthlyTotal`, `computeRecurringCommitment`. 14 tests unitaires ajoutés. Zéro changement de comportement.
   - **Reste** : `BudgetManagerPanel.tsx` (578) et `RAVEditor.tsx` (559) délèguent déjà l'essentiel à `budgetManagerHelpers.ts` / `ravCalculations.ts` — peu de logique pure inline restante, faible priorité.
3. ✅ **A11y mobile** (2026-07-06) : les `eslint-disable jsx-a11y` des 6 composants `mobile/` supprimés. Les 5 modals (`MBudgetFormModal`, `MPositionsImportModal`, `MPlacementFormModal`, `MBudgetExclusionsModal`, `MLinkRecurrenceModal`) passent au motif **backdrop = `<button aria-label="Fermer">` frère** d'un panneau `role="dialog"`/`aria-modal`/`aria-label` (supprime le `stopPropagation`, apparence identique). `MCategoryRow` : révélation du bouton en CSS pur (`group-active:opacity-100`) au lieu des handlers `onTouch*`/`onMouse*` + state. Zéro `eslint-disable jsx-a11y` restant dans `mobile/`. 2 tests jest-axe ajoutés (dialog + row). Vérifié : `npm run lint`/`typecheck`/`test`/`build`.
4. ✅ **Doublons UI — TRANCHÉ ET FAIT (2026-07-06)**. Étape « gain sûr » : agrégation inline d'`AurumWealthPage` extraite vers `utils/wealthSnapshot.ts` (`computeWealthTotals` partagée avec `usePatrimoine.totals`, `buildAurumSnapshotOptions`, `buildAurumAssetRows`, +6 tests). Puis **décision produit prise par le propriétaire : `WealthPage` (route `/patrimoine`) est la vue canonique**, le shell `/aurum.html` n'est plus utilisé. Exécuté :
   - Correction du diagnostic initial : `AurumDashboard` n'était PAS exclusif au shell aurum — c'est le dashboard de la route `/` de MainApp (`standalone={false}`), et la palette Cmd+K permettait d'atteindre l'onglet `wealth` depuis l'app principale. Le périmètre réel de la suppression a été recalculé en conséquence.
   - Rapatriement d'abord : `AurumWealthPositionsChart` → `components/WealthPositionsChart.tsx`, section « Positions dans le Temps » ajoutée à `WealthPage`.
   - Supprimés : `public/aurum.html`, `aurum-entry.tsx`, entrée `aurum` de `vite.config.js` + denylist PWA, `AurumWealthPage` + `AurumWealthAssets` + `AurumWealthDetailedChart`, et `AurumAccountDetailPage` (atteignable uniquement en mode standalone).
   - `AurumDashboard` : prop `standalone` retiré (toujours false), tab bar standalone supprimée, cases `wealth`/`account_detail` retirés du switch ; la palette Cmd+K « Patrimoine » navigue désormais vers `/patrimoine` (vue canonique).
   - Docs mises à jour (`ARCH_STATE.md`).
5. ✅ **Mutualisation desktop/mobile — lots 1 et 2 (2026-07-06)**. La couche données (hooks/contexts) était déjà partagée ; on a mutualisé la logique métier recopiée :
   - **Formulaire budget** : nouveau `lib/budgetForm.ts` (`buildBudgetDefaults`, `buildBudgetPayload`, `periodeTypeFor`) consommé par `BudgetFormModal` (desktop) ET `MBudgetFormModal` (mobile). Le mobile valide désormais via `budgetFormSchema` (zod). Corrige trois divergences d'écriture du mobile : `periode.type` toujours `mois_courant` (même en annuel), écrasement de `moisAttendus`/`compte` à l'update (perte de données saisies sur desktop), `isIncome: undefined` au create. `BudgetsScreen` passe le `BudgetBase` complet au modal. Changement assumé : un budget « ponctuel » sans dates est désormais refusé sur mobile (règle desktop), au lieu d'écrire un document malformé. 10 tests unitaires.
   - **AnalyseScreen** : pipeline récurrences inline (classement payé/ignoré/à approuver/attendu + tri) remplacé par `processRecurrences`/`sortRecurrences` (utils partagés avec `AurumRecurringPage`). Deltas assumés : l'appariement filtre les transactions par période de **date** (comme desktop) et non plus par `moisAffectation` ; repli `||` au lieu de `??` sur montant approuvé nul dans le tri. `summary` et `categoryData` restent propres au mobile (sémantiques différentes voulues : sorties signées, mode récurrences par transaction).
   - **Options de formulaire** : `HomeScreen` et `TransactionsScreen` recopiaient à l'identique la dérivation catégories/comptes (candidats budget + catégories des transactions ; comptes des soldes). Nouveau hook `useFormOptions()` (+ fonctions pures `deriveCategoryOptions`/`deriveAccountOptions`, 5 tests) consommé par les deux — supprime au passage les appels `useBudget`/`useBalances` devenus inutiles dans ces écrans. **Desktop non unifié volontairement** : `AnalyseSection` & co. utilisent une variante `localeCompare('fr')` + `.trim()` (ordre d'affichage différent) — les toucher changerait le tri, hors périmètre « ne rien casser ». `QAScreen` : rien à mutualiser (déjà sur `usePersistentFinanceQA`, reste = UI de chat).
   - **Reste (fil de l'eau)** : le groupement par date de `TransactionsScreen` pourrait rejoindre celui des listes desktop, mais les formes de clés/labels diffèrent — à traiter avec soin si un jour utile.

**Vérification** : `npm run analyze` avant/après (taille bundle) ; profiling React DevTools sur la liste transactions avec gros volume ; tests a11y jest-axe.

---

## Phase 8 — reste à faire (spec détaillée pour reprise ultérieure)

Les deux items ci-dessous ont été **volontairement différés** sous la contrainte « ne rien casser » : tous deux à haut risque et **non vérifiables sans navigateur** (voire, pour le second, sans une décision produit). Cette section les décrit assez précisément pour être attaqués tels quels plus tard.

### Item 1 — Borner le DOM des listes de transactions (virtualisation)

**Problème exact.** Les deux listes rendent `grouped.slice(0, count)` où `count` est un état incrémenté par un `IntersectionObserver` sur une sentinelle. `count` ne **décroît jamais** → le DOM croît sans borne au fil du scroll ; les groupes sortis de l'écran ne sont **jamais démontés**. Les composants de ligne sont déjà `React.memo` (`TransactionCard`, `TransactionRow`), donc le coût est surtout le **nombre de nœuds DOM**, pas le re-render.

- **Fichiers** : `public/src/components/transactions/TransactionGroupedList.tsx` (état `visibleDaysCount`, constantes `BATCH_DAYS_COUNT` / `OBSERVER_ROOT_MARGIN`, sentinelle + observer aux ~l.248-270) et `public/src/components/dashboard/TransactionList.tsx` (état `visibleGroupsCount`, `BATCH_GROUPS_COUNT`, `rootMargin '200px'`, ~l.391-412). Structure identique : groupes datés = header **sticky** (`position: sticky top-0`) + N lignes.

**Option A — `content-visibility: auto` (recommandée en premier : minimale, réversible).**

1. Envelopper chaque groupe daté dans un conteneur avec `style={{ contentVisibility: 'auto', containIntrinsicSize: '<hauteur estimée d'un groupe>px' }}`. Le navigateur saute le layout/paint des sous-arbres hors écran **sans** les retirer du DOM React (donc pas de casse du scroll infini ni du temps réel).
2. Garder le mécanisme observer+slice tel quel (le `slice` reste, mais le coût de layout des groupes hors écran devient ~nul).
3. **Point de vigilance** : interaction avec les headers de date `sticky` — vérifier en navigateur que le sticky reste correct quand le groupe passe en `content-visibility: hidden`. Si conflit, sortir le header du conteneur `content-visibility`.

**Option B — `@tanstack/react-virtual` (robuste mais invasive, seulement si A insuffisant).**

1. Ajouter la dépendance `@tanstack/react-virtual` (impact bundle → `npm run analyze`).
2. Aplatir groupes+lignes en une liste unique d'items (`{type:'header'|'row', ...}`), `useVirtualizer({ count, estimateSize, measureElement })` (hauteurs **variables** → `measureElement` obligatoire).
3. **Points durs** : (a) headers de date `sticky` incompatibles avec le conteneur `transform` du virtualizer → utiliser le pattern « sticky index » documenté ou headers en position absolue ; (b) **préserver la position de scroll** lors des insertions temps réel en tête de liste (nouvelles transactions) ; (c) hauteurs variables (montants sur plusieurs lignes).

**Vérification (obligatoirement navigateur, non couvrable par vitest).**

- `npm run dev`, écran Transactions avec un gros historique (> ~2000 tx — au besoin seed local). Mesurer `document.querySelectorAll('[data-tx-row]').length` (ajouter un `data-*` au besoin) **après un long scroll** : doit rester **borné** (≠ croissance monotone actuelle).
- Non-régression manuelle : scroll infini fonctionne, headers de date corrects/sticky, tri conservé, insertion temps réel d'une nouvelle transaction ne saute pas le scroll.
- `npm run analyze` si Option B (nouvelle dép).

**Pourquoi risqué.** Écran le plus utilisé de l'app ; interactions subtiles (sticky, temps réel, hauteurs variables) ; **impossible à valider en tests unitaires**. → commencer par l'Option A (1 wrapper CSS, revert trivial).

### Item 4 — Unifier les implémentations Patrimoine

**État exact — 3 implémentations distinctes** consommant les **mêmes** données (`usePatrimoine` + `usePortfolio`) mais ré-implémentant présentation **et** une partie de l'agrégation :

- `public/src/components/WealthPage.tsx` (523 l.) — rendu par `PatrimoineSection.tsx` (route patrimoine du shell `main.ts`). Utilise en plus `useWealthAggregates` + `useWealthScope`.
- `public/src/components/dashboard/v2/AurumWealthPage.tsx` (383 l., lazy) — rendu par `AurumDashboard` (shell premium `aurum-entry`). **N'utilise PAS** `useWealthAggregates` → agrégation ré-implémentée inline.
- `public/src/mobile/screens/PatrimoineScreen.tsx` (342 l.) — vue mobile.

**Étapes (risque croissant, chacune commit-able / vérifiable).**

1. **Investigation d'abord** : matrice « qui calcule quoi » entre les 3 fichiers vs. ce qui existe déjà (`hooks/useWealthAggregates`, `utils/wealthSnapshot.ts` [créé en 8.2], `utils/portfolioReconstruction.ts`, `utils/wealthTimeline.ts`). Lister totaux, allocation par type, delta 30 j, regroupements owner/type.
2. **Gain sûr (à faire en premier, même méthode que 8.2)** : extraire l'agrégation ré-implémentée inline d'`AurumWealthPage` vers un util pur testé (ou lui faire consommer `useWealthAggregates`). Réduit la divergence de **calcul** sans toucher au layout. **Vérifiable par tests unitaires.**
3. Vérifier que les 3 vues réutilisent bien les sous-composants de présentation déjà factorisés (`WealthTotalCard`, `WealthAllocationBars`, `WealthAccountsList`, `WealthPortfolioTable`…) plutôt que de re-styler.
4. **Décision produit à trancher avec le propriétaire (NE PAS trancher depuis le code seul)** : le shell `main.ts` / `PatrimoineSection` (→ `WealthPage`) est-il encore une route active, ou l'app a-t-elle basculé sur le shell Aurum (→ `AurumWealthPage`) ? Tant que ce n'est pas confirmé, **ne pas supprimer** l'une des vues (risque de casser une route vivante).
5. Une fois tranché : supprimer la vue morte, rediriger sa route vers la vue retenue.

**Vérification** : tests unitaires sur la logique extraite (étape 2) ; smoke navigateur des écrans patrimoine conservés (totaux, allocation, historique identiques) ; `npm test`, `npm run build`.

**Pourquoi risqué.** L'étape 4 est une **décision produit** non déterminable depuis le code ; supprimer une vue peut casser une route active ; les 3 layouts (desktop legacy / desktop premium / mobile) sont des choix assumés à ne pas fusionner aveuglément. **Seule l'étape 2 est un gain sûr** ; le reste demande une validation humaine.

---

## Hors périmètre (mentionné, non planifié)

- **Argent en float** : tout le code (Python et TS) manipule les montants en `float`/`number` avec sommes naïves (~58 sites frontend, `parse_montant_fr` backend). Le passage en centimes entiers/`Decimal` serait la correction de fond mais touche le stockage Firestore, les deux backends et tout le frontend — chantier à part entière, à décider séparément.
- Refonte de l'isolation par utilisateur dans Firestore (app mono-utilisateur assumée).

## Ordre et reprise

Phases 1 → 4 dans l'ordre (valeur décroissante, la 6 dépend de la 1). Phases 5 et 7 sont indépendantes et insérables n'importe quand après la 2. La 8 en dernier. Chaque phase : créer une branche `phase-N-<sujet>`, commits atomiques, PR, CI verte, merge — puis pause possible sans risque.
