# Build pipeline — `build` vs `build:premium`

## Vue d'ensemble

L'app AURUM produit **une seule entrée HTML** :

| Entry HTML          | Route Firebase     | Script chargé                    | Rôle                                                                         |
| ------------------- | ------------------ | -------------------------------- | ---------------------------------------------------------------------------- |
| `public/index.html` | `/` (fallback SPA) | `/src/main.ts` → React AppRouter | Application complète (Console, Flux, Budgets, Analyse, Patrimoine, Réglages) |

> **Note historique.** Ce document décrivait une seconde entrée
> `public/aurum.html` (route `/aurum`, script `/src/aurum-entry.jsx`) pour une
> « vue Premium / Private Wealth » dédiée. Cette entrée a été **supprimée en
> juillet 2026** en même temps que `AurumWealthPage` — la vue patrimoine
> canonique vit désormais sur la route `/patrimoine` de l'app principale.
> `vite.config.js` ne déclare plus qu'un seul point d'entrée
> (`rollupOptions.input.main`). Les sections ci-dessous ont été corrigées en
> conséquence.

`AppRouter` choisit ensuite entre `MainApp` (desktop) et `MobileApp` (PWA)
selon le breakpoint 768 px — les deux consomment le même Design System
(`public/src/ui/`).

## Commandes

```bash
# Build standard — produit dist/index.html + chunks
npm run build

# Build premium — identique, mais Vite reçoit `--mode premium`,
# ce qui change le résultat de `loadEnv(mode, …)` (cf. vite.config.js:8)
# et active la lecture de `.env.premium` ou `.env.premium.local`.
npm run build:premium
```

> `build:premium` ne change **que** le mode Vite — c'est-à-dire quels fichiers
> `.env` sont chargés. Il ne produit ni entrée ni bundle supplémentaire.

## Configuration Vite (`vite.config.js`)

```js
build: {
  outDir: '../dist',
  emptyOutDir: true,
  rollupOptions: {
    input: {
      main: 'public/index.html',
    },
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          if (id.includes('firebase')) return 'vendor-firebase';
          if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts';
          if (id.includes('framer-motion')) return 'vendor-motion';
          if (id.includes('react-intl')) return 'vendor-intl';
        }
      },
    },
  },
}
```

- **`root: 'public'`** — Vite sert et construit depuis `public/`.
- **PWA** — `VitePWA` en `registerType: 'autoUpdate'`, `theme_color` et
  `background_color` à `#0B0B14`. Les `.woff2` sont précachés (polices
  auto-hébergées dans `public/fonts/`, aucune dépendance externe).
- **Analyse de bundle** — `ANALYZE=true npm run build` (`npm run analyze`)
  produit `dist/stats.html`.
- **Sentry** — le plugin ne s'active que si `VITE_SENTRY_DSN` est défini.

## Chaîne de build

```
public/index.html  ──►  rollup  ──►  dist/index.html  ──►  Firebase /
public/src/**            +                +
                     tailwind.css     chunks vendor-*
                          │
                   public/src/ui/tokens.css   (source unique des tokens)
```

## Qualité

Le job `quality` de `.github/workflows/frontend-ci.yml` exécute cinq
vérifications en matrice sur toute PR touchant `public/src/**`, `tests/**` ou
`package*.json` :

```
lint      → npm run lint            # eslint .
format    → npm run format:check    # prettier --check .
typecheck → npm run typecheck       # tsc --noEmit
test      → npm test -- --run       # vitest
design    → npm run check:design    # garde-fou du Design System
```

Voir `DESIGN_SYSTEM.md` § 4 pour le fonctionnement du cliquet.
