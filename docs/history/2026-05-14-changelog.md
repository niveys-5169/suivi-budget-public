# Changelog — 14 mai 2026

Synthèse de toutes les modifications mergées sur `main` ce jour.

---

## ✨ Fonctionnalités

### Budget YTD annuel (`feat(budget)`)

- **`BankinBudgetMain`** : ajout de la prop optionnelle `totalIncomeBudget` (budget revenu annuel).
- Le calcul de la ligne théorique utilise `totalIncomeBudget` si fourni, sinon `totalReceived` (réalisé).
- Labels adaptatifs en mode annuel : "Solde Net YTD (Annuel)", "Encaissé YTD", "Dépensé YTD".
- **`BankinBudgetsContainer`** : passage de `totalIncomeBudget` calculé vers `BankinBudgetMain`.

---

## ♻️ Refactoring

### Catégories patrimoine (`refactor(types)`)

- **`WealthEvolutionBudgetChart`** : `CategoryKey` renommé de `epargne/investissements/retraite` → `epargnelivrets/placements/bourse`.
- `CATEGORY_LABELS`, `CATEGORY_COLORS` et `resolveCategory` mis à jour en conséquence.
- Casts `any` temporaires dans `BudgetDashboard` (`LegacyBudgetState`) et `BudgetKPIs` (`BUDGET_ANNUAL_HISTORY`) — à migrer vers le contexte.
- Mocks `AnalyseSection.test.tsx` mis à jour pour les nouvelles dépendances de contexte.

### ESLint rules-of-hooks (`refactor`)

- Correction des violations `react-hooks/rules-of-hooks` dans 37 fichiers.
- Correction des entités non-échappées dans JSX.

### Bridges `window.*` typés — Sprint 3.1 (`refactor(legacy)`)

- Création de **`public/src/types/globals.d.ts`** : source unique de vérité pour tous les bridges `window.*`.
- Remplacement de tous les `(window as any).X` par `window.X` typé dans les fichiers TS/TSX.
- `hideLoader` : 7 call sites migrés vers l'import direct depuis `utils/loader`.

---

## 🆕 Nouveaux utilitaires (Sprints 2 & 3)

### Accessibilité WCAG AA — Sprint 2.1

- **`public/src/hooks/useFocusTrap.ts`** : focus trap Tab/Shift+Tab, restauration du focus.
- **`public/src/components/shared/Modal.tsx`** : `role="dialog"`, `aria-modal`, `aria-labelledby`, Escape, backdrop click. Remplace le pattern portal ad-hoc.
- `TransactionFormModal` migré vers `Modal`.

### Robustesse Firestore — Sprint 2.2

- **`public/src/utils/toast.ts`** : wrapper typé `toast.success / .error / .info / .loading / .dismiss`.
- **`public/src/utils/firestoreError.ts`** : 14 codes Firebase → messages FR. Prédicat `isRetryable()`.
- **`public/src/utils/withRetry.ts`** : retry async avec backoff exponentiel (500 → 1000 → 2000 ms, 3 tentatives).
- Tous les `alert()` remplacés par des toasts.

### Performance bundle — Sprint 1.2

- `rollup-plugin-visualizer` : script `npm run analyze` → `dist/stats.html`.
- Lazy routes : `TransactionsSection`, `BudgetsV2Section`, `FinanceQASection`, `AdvancedSettings` + toutes sous-pages avancées.
- `DashboardSection` reste eager (landing route).

### Storybook & Tests — Sprint 3.2

- **`.storybook/main.ts` + `preview.ts`** : Storybook 8 Vite, `addon-essentials`, `addon-a11y`, `addon-interactions`.
- Stories : `Modal.stories.tsx`, `PageHeader.stories.tsx`, `MonthNavigator.stories.tsx`.
- Scripts : `npm run storybook` (dev :6006), `npm run build-storybook`.
- Tests unitaires : `firestoreError.test.ts` (14 assertions), `withRetry.test.ts`, `toast.test.ts`.

---

## 🔧 Infrastructure & CI

### Node.js v24 (`ci(workflows)`)

- Tous les workflows GitHub Actions migrés vers `node-version: "24"`.
- Ajout `--legacy-peer-deps` sur tous les `npm ci` / `npm install`.
- Dependabot : groupe Storybook ajouté.
- CodeQL : skippé sur les PRs Dependabot.
- Workflow `deploy-functions.yml` : suppression de l'étape Python setup inutile.

### Workflow Sécurité (`chore`)

- Nouveau fichier **`.github/workflows/security.yml`**.
- Jobs : `npm-audit`, `pip-audit` (racine + functions), `codeql` (JS/TS).
- Déclencheurs : push/PR `main` (sur chemins pertinents) + schedule quotidien à 05:00 UTC.

---

## 📦 Dépendances mises à jour

### Python (`requirements.txt` + `functions/requirements.txt`)

| Package                | Avant   | Après   |
| ---------------------- | ------- | ------- |
| `beautifulsoup4`       | 4.12.3  | 4.14.3  |
| `cryptography`         | 46.0.7  | 48.0.0  |
| `google-auth-httplib2` | 0.2.0   | 0.4.0   |
| `pytest`               | ≥7.0.0  | ≥9.0.3  |
| `pytest-mock`          | ≥3.10.0 | ≥3.15.1 |
| `firebase-admin`       | —       | ≥7.4.0  |

### GitHub Actions

| Action                       | Avant | Après |
| ---------------------------- | ----- | ----- |
| `actions/checkout`           | v4    | v6    |
| `google-github-actions/auth` | v2    | v3    |

### JavaScript

- Firebase SDK et packages Storybook mis à jour (`chore(deps)`).

---

## 🎨 Formatage

- `.prettierignore` mis à jour : exclusion de `venv/`, `.cline/`, `.claude/`.
- Prettier `--write` appliqué sur 340+ fichiers (normalisation LF, style cohérent).

---

## 📝 Documentation

- `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `implementer-prompt.md` : alignement instructions agents IA.
- `docs/ARCH_STATE.md` : mis à jour (état sprint 3, nouveaux utilitaires).
- `docs/DEV_TOOLING.md` : nouveaux scripts, Storybook, workflow sécurité, progression sprints.
- `README.md` : stack mise à jour (Node.js v24, Storybook, jest-axe), nouvelles commandes, CI/CD complet, changelog fonctionnalités.
