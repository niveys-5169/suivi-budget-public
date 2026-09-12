# Outillage Frontend — Lint, Format, CI

Mise en place du Sprint 1.1 de la roadmap qualité. Objectif : zéro warning, formatage uniforme, garde-fous CI.

## Stack

| Outil                    | Rôle                         |
| ------------------------ | ---------------------------- |
| ESLint 9 (flat config)   | Lint TS/React/Hooks/JSX-a11y |
| Prettier 3               | Formatage                    |
| Husky 9 + lint-staged 15 | Garde-fou local pre-commit   |
| GitHub Actions           | Garde-fou CI sur PR & main   |

## Installation locale (à faire une fois)

```bash
npm install
```

Le script `prepare` enregistre automatiquement le hook Husky (`.husky/pre-commit`). Si le hook n'est pas exécutable, lance :

```bash
chmod +x .husky/pre-commit
```

## Scripts npm

| Commande                  | Action                                                               |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run lint`            | Lint l'ensemble du projet                                            |
| `npm run lint:fix`        | Lint + corrections auto                                              |
| `npm run format`          | Formatte tout via Prettier                                           |
| `npm run format:check`    | Vérifie le formatage (mode CI)                                       |
| `npm run typecheck`       | `tsc --noEmit` sur `tsconfig.json`                                   |
| `npm test`                | Vitest                                                               |
| `npm run analyze`         | Build + rapport bundle (`dist/stats.html`, nécessite `ANALYZE=true`) |
| `npm run storybook`       | Storybook en dev sur `:6006`                                         |
| `npm run build-storybook` | Export Storybook statique                                            |

## Pre-commit

À chaque commit, `lint-staged` lance ESLint + Prettier sur les fichiers staged uniquement (rapide). Si un fichier ne passe pas, le commit est bloqué — corrige et re-stage.

Pour bypasser (cas d'urgence uniquement) : `git commit --no-verify`. À éviter — préférer corriger.

## CI

### `frontend-ci.yml`

Se déclenche sur push/PR vers `main` lorsque `public/src/**`, `tests/**` ou les configs sont modifiés.

Étapes : `npm ci --legacy-peer-deps` → `lint` → `format:check` → `typecheck` → `test`.

> Node.js v24 depuis le 14 mai 2026. Le flag `--legacy-peer-deps` est nécessaire pour les peer deps Firebase/Storybook.

### `security.yml` (nouveau — 14 mai 2026)

Workflow dédié sécurité, déclenché sur push `main`, PR, et schedule quotidien à 5h00 UTC.

| Job         | Outil       | Scope                                              |
| ----------- | ----------- | -------------------------------------------------- |
| `npm-audit` | `npm audit` | Dépendances JavaScript                             |
| `pip-audit` | `pip-audit` | Dépendances Python (`requirements.txt`)            |
| `codeql`    | CodeQL      | Analyse statique TS/JS (skippé sur PRs Dependabot) |

## Configuration ESLint

Voir `eslint.config.js`. Décisions clés :

- **Flat config moderne** (ESLint 9+), ESM.
- **Règles a11y baseline** activées en `warn` (montée en `error` au Sprint 2.1).
- **`exhaustive-deps` en `warn`** pour permettre l'adoption sans casser tout — passera en `error` une fois la dette résorbée.
- **`@typescript-eslint/no-explicit-any` en `warn`** — tolérance pendant la migration legacy.
- **Fichiers legacy JS** (`public/src/store.js`, `firebase-setup.js`, `theme.js`, `main.js`) : règles relâchées (override) — voir `docs/ARCH_STATE.md`.

## Configuration Prettier

Voir `.prettierrc.json`. Choix :

- `printWidth: 100`
- `singleQuote: true` (`jsxSingleQuote: false`)
- `trailingComma: 'all'`
- `semi: true`

## Adoption progressive

1. ✅ **Sprint 1.1** : config ESLint/Prettier/Husky installée, CI en place.
2. ✅ **Sprint 1.2** : `npm run lint:fix` + `npm run format` appliqué sur 340+ fichiers. Bundle analyzer + lazy routes.
3. ✅ **Sprint 2.1** : Règles a11y passées en `error`, `jest-axe` intégré, `Modal` WCAG AA, `useFocusTrap`.
4. ✅ **Sprint 2.2** : `toast.ts`, `firestoreError.ts`, `withRetry.ts` — `alert()` remplacés.
5. ✅ **Sprint 3.1** : `types/globals.d.ts` — zéro `(window as any)` dans les fichiers TS/TSX.
6. ✅ **Sprint 3.2** : Storybook 8 + tests unitaires utilitaires.
7. 🟡 **Suivant** : Résorber les `any` temporaires dans `BudgetDashboard` et `BudgetKPIs`.

## Désactiver une règle ponctuellement

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  /* … */
}, []);
```

Toujours commenter **pourquoi** — sinon la dette devient invisible.
