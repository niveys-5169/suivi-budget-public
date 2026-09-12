# Comparaison Picsou-Finance ↔ Suivi-Budget & roadmap d'améliorations

## Contexte

Analyse comparative avec [Zoeille/picsou-finance](https://github.com/Zoeille/picsou-finance) (dashboard finance self-hosted, v1.0.0) pour identifier ce qui mérite d'être repris dans Suivi-Budget. Périmètre demandé : **design/UX et automatisation de la récupération des transactions** — les fonctionnalités métier (budgets, RAV, prévisions, patrimoine, IA) sont jugées suffisantes et ne sont pas dans le périmètre.

Décisions déjà actées :

- **Dark-only conservé** : le design system AURUM (Gold/Ink) reste sans mode clair.
- **Chantier prioritaire** : gestion des connexions Enable Banking in-app (chantier 1).
- Livrable initial = ce document ; l'implémentation suivra chantier par chantier.

---

## A. Comparaison synthétique

| Axe                           | Picsou-Finance                                                                                                          | Suivi-Budget                                                                                                                                                                    | Verdict                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Stack**                     | Spring Boot 3.4 (Java 21) + React 19/Vite/Tailwind v4 + PostgreSQL                                                      | React 18/TS/Vite 8/Tailwind 4 (PWA) + Firestore temps réel + Python (GitHub Actions & Cloud Functions)                                                                          | Équivalent — deux archis cohérentes, pas de retard                                                                            |
| **Déploiement**               | Docker self-hosted (réseau local uniquement), serveur always-on                                                         | Firebase Hosting + jobs GitHub Actions cron, zéro serveur à maintenir                                                                                                           | Avantage Suivi-Budget (zéro ops), mais limite les intégrations « session vivante » (cf. E)                                    |
| **Design system**             | shadcn/ui (Radix) générique, thème system/light/dark                                                                    | AURUM sur mesure : tokens Gold/Ink, glassmorphism, Playfair Display, Framer Motion, Storybook + jest-axe                                                                        | Avantage Suivi-Budget sur l'identité visuelle ; avantage Picsou sur la **robustesse des primitives** (Radix) — cf. chantier 2 |
| **Sync bancaire (PSD2)**      | Enable Banking, wizard de connexion **in-app**, re-sync quotidien 08:00 (`SchedulerService`), statut dans `BankSyncTab` | Enable Banking (`src/eb_importer.py`), cron GitHub Actions quotidien + poll Linxo 30 min, **onboarding par script local** (`scripts/eb_setup.py`) et sessions en secrets GitHub | **Écart principal** : même fournisseur, mais cycle de vie des sessions industrialisé chez Picsou — cf. chantier 1             |
| **Sources hors PSD2**         | Sidecars Playwright `tr-auth` (Trade Republic WebSocket) et `bourso-auth` (BoursoBank), import CSV/Finary               | Gmail/Linxo (fallback), Tronity (recharge VE), import Excel positions                                                                                                           | Match nul — approches différentes pour le même problème (le PSD2 ne couvre que les comptes courants)                          |
| **Post-traitement**           | Dédup holdings, détection de type de compte                                                                             | Dédup 60 j multi-sources, catégorisation IA (RAG + lexical), réconciliation de soldes automatisée                                                                               | Avantage Suivi-Budget                                                                                                         |
| **Visibilité sync dans l'UI** | Statut par connexion, bannières de readiness (Admin → Integrations), avertissements SANDBOX/périmètre PSD2              | Bouton refresh (PAT GitHub en localStorage), aucune vue des sessions ni des dernières synchros                                                                                  | Écart — repris dans les chantiers 1 et 3                                                                                      |

**Conclusion** : pas de retard fonctionnel ni de retard sur le choix d'agrégateur (Enable Banking des deux côtés). Les emprunts pertinents à Picsou sont (1) le **cycle de vie des connexions bancaires géré dans l'app**, (2) la **robustesse des primitives UI**, (3) quelques touches visuelles (logos banques, badges de statut de sync).

---

## Chantier 1 — Gestion des connexions bancaires in-app (priorité) — ✅ IMPLÉMENTÉ (2026-07-08)

> Livré dans cette même PR. Étapes 1.1 → 1.4 réalisées : sessions dans Firestore
> avec repli env, Cloud Functions OAuth `eb_auth_start`/`eb_auth_callback`, page
> `/connexions` (Paramètres avancés → Expert) et bannière d'expiration du
> dashboard. Voir les commits `feat(eb): …`. Reste à faire côté exploitation :
> déclarer le Redirect URI de la function dans le Control Panel Enable Banking,
> déployer les functions (`firebase deploy --only functions`), puis lancer
> `python scripts/migrate_eb_sessions_to_firestore.py` pour importer les sessions
> existantes et enfin retirer les secrets `EB_SESSIONS`/`EB_ACCOUNT_MAPPING`.

**Problème actuel** : `scripts/eb_setup.py` doit être lancé localement à chaque expiration de consentement PSD2 (≈ 90–180 j selon la banque), avec copier-coller manuel de l'URL de callback, puis mise à jour des secrets GitHub `EB_SESSIONS` / `EB_ACCOUNT_MAPPING`. Aucune visibilité in-app sur l'état des sessions : on découvre l'expiration quand l'import échoue.

**Cible** (inspirée du « Add Account modal bank wizard » et du panneau « Admin → Integrations » de Picsou) :

### 1.1 Sessions dans Firestore

- Nouvelle collection `eb_sessions` : `{ session_id, bank_name, country, account_ids[], account_mapping{}, valid_until, created_at, last_import_at, status }`.
- `src/eb_importer.py` lit les sessions depuis Firestore via `firebase_db.py` ; **fallback** sur l'env `EB_SESSIONS` si la collection est vide (transition douce, aucun big-bang). Mise à jour de `last_import_at` après chaque import réussi.
- Migration one-shot : script qui pousse le contenu actuel de `EB_SESSIONS`/`EB_ACCOUNT_MAPPING` dans Firestore (pattern des `scripts/migrate_*.py` existants).

### 1.2 Cloud Function de callback OAuth

- Deux endpoints dans `functions/` (pattern existant de `functions/src/reconciliation_actions.py`) :
  - `eb_auth_start(bank, country)` → renvoie l'URL d'autorisation (réutilise `enable_banking_client.get_auth_url`, module déjà partagé `src/` ↔ `functions/` via le mécanisme de modules miroirs).
  - `eb_auth_callback(code)` → `create_session`, écrit la session dans `eb_sessions`, redirige vers l'app. Redirect URI configurée côté Enable Banking = URL de cette function → **fin du copier-coller manuel**.
- Reprendre la garde de Picsou sur le **re-submit du code OAuth** (bouton retour navigateur) : si le code a déjà été consommé, rafraîchir la dernière session liée au lieu d'échouer.
- Auth : endpoints réservés à l'utilisateur Firebase authentifié (même modèle que les functions de réconciliation).

### 1.3 Page « Connexions bancaires »

- Nouvelle page dans `public/src/components/advanced/` (même intégration que `RulesPage.tsx`/`MappingsPage.tsx`), composants `shared/Card`, `shared/Modal`, style AURUM.
- Contenu : liste des sessions avec statut coloré (active / expire < 15 j / expirée, calculé sur `valid_until`), date de dernier import par compte, mapping compte→budget éditable (écrit `account_mapping`), bouton « Connecter / Reconnecter une banque » qui ouvre le flow OAuth (1.2).
- Leçons UX de Picsou à reprendre dans le wizard : avertissement mode SANDBOX vs PRODUCTION du dashboard Enable Banking, note sur le périmètre PSD2 (comptes courants uniquement — Livret A/PEA/assurance-vie restent en saisie/import manuel).

### 1.4 Bannière d'expiration

- Sur le dashboard (`dashboard/v2/`), bannière quand une session expire sous 15 jours, lien direct vers la page Connexions. Sous-produit naturel du `valid_until` en Firestore.

**Vérification** : `pytest` (dont test de sync des modules miroirs `src/` ↔ `functions/`), test manuel du flow OAuth complet en sandbox EB puis en production, `npm test` + Vitest sur la page UI, import quotidien vert 3 jours d'affilée après bascule Firestore.

---

## Chantier 2 — Qualité UI/UX (arrondis, texte coupé) — ✅ PARTIELLEMENT IMPLÉMENTÉ (2026-07-09)

> Approche retenue : **corrections ciblées à faible risque** plutôt qu'un sweep
> massif des ~600 arrondis (diff énorme, risque de régression visuelle partout).
> Livré dans cette PR : `title` sur 9 libellés tronqués à fort trafic ; règles
> d'affichage figées dans `DESIGN_SYSTEM.md` (radius imbriqué, anti-clipping,
> troncature = title) ; token `rounded-tile` ; garde-fou CI
> `scripts/check-arbitrary-radius.mjs` (baseline 112, ne peut que baisser).
> **Reste ouvert** (nécessite de voir l'app tourner / un screenshot) : les clips
> pixel-près restants, la migration progressive des arrondis vers les tokens
> (au fil de l'eau, en abaissant la baseline), et l'adoption ponctuelle de
> shadcn/Radix + régression visuelle Playwright (§2.3).

**Problème rapporté** : arrondis mal placés, textes légèrement coupés.

### 2.1 Normalisation des arrondis

Audit (2026-07-08) sur `public/src/components/` : **~25 valeurs de radius différentes** — 217× `rounded-xl`, 166× `rounded-2xl`, 101× `rounded-lg`, et ~130 valeurs arbitraires (`rounded-[2rem]`, `[2.5rem]`, `[2.8rem]`, `[2.4rem]`, `[2.2rem]`, `[1.8rem]`, `[1.6rem]`, `[18px]`, `[1.5rem]`) — alors que `tailwind.config.js:79-85` définit les tokens canoniques `rounded-control` (0.75rem), `rounded-card` et `rounded-sheet` (2rem, doublons).

1. Trancher les doublons de tokens : différencier `card`/`sheet` ou fusionner ; ajouter au besoin un token intermédiaire (ex. `rounded-tile` ~1rem) pour couvrir les usages `xl/2xl` légitimes.
2. Sweep de remplacement des valeurs arbitraires par les tokens (mécanique, par lots de composants).
3. Documenter dans `DESIGN_SYSTEM.md` la **règle de radius imbriqué** : `radius enfant = radius parent − padding` — cause classique des « arrondis mal placés » (un enfant `rounded-2xl` collé au bord d'un parent `rounded-[2.8rem]` produit un coin visuellement cassé).
4. Garde-fou CI : interdire `rounded-[` dans `public/src/components/` (règle `eslint-plugin-tailwindcss` ou check grep dans `frontend-ci.yml`).

### 2.2 Texte coupé

Audit ciblé des combinaisons connues, puis règles figées dans `DESIGN_SYSTEM.md` :

- **Playfair Display** (`font-serif text-5xl` des montants héros) avec `leading` trop serré : les descendantes (g, j, p, €) sont amputées → line-height minimal à définir pour les montants serif.
- **`bg-clip-text`** coupe les descendantes par défaut → `pb-[0.1em]` (ou équivalent) sur les textes en dégradé.
- **`overflow-hidden` + hauteur fixe** sur les cartes/lignes : vérifier les 12+ usages recensés dans `components/` (donc `budgets-v2/bankin/*`, `WealthPortfolioTable`, pages advanced).
- **`truncate`** sans tooltip : ajouter `title` sur les libellés tronqués.

### 2.3 Outils à adopter

1. **shadcn/ui (primitives Radix)** restylées avec les tokens AURUM — le choix de Picsou. À introduire **au cas par cas** sur les composants à comportement délicat (popover, dropdown, tooltip, sheet/drawer) : on garde le look Gold/Ink (shadcn = code copié dans le repo, entièrement thémable), on gagne des comportements robustes (portals, focus-trap, gestion d'overflow, positionnement) qui éliminent une classe entière de bugs visuels. Ne pas remplacer les composants sains (`shared/Card`, `shared/Modal` a déjà son focus-trap).
2. **Régression visuelle** : screenshots Playwright sur les stories Storybook existantes (Storybook 8 + Playwright déjà dans le repo) pour verrouiller les fixes radius/clipping — un snapshot par composant `shared/` et par carte du dashboard.
3. **`eslint-plugin-tailwindcss`** : bannir les valeurs arbitraires, ordonner les classes — s'inscrit dans la politique « Zero Warning » existante.

**Vérification** : `npm run lint` sans warning avec la nouvelle règle, suite de snapshots Playwright verte, revue visuelle manuelle des pages Dashboard/Budgets/Transactions/Patrimoine (desktop + mobile PWA).

---

## Chantier 3 — Touches design ponctuelles (dark-only conservé) — ✅ IMPLÉMENTÉ (2026-07-09)

> Livré dans cette PR : pastille de banque `BankLogo` + registre `bankBranding`
> (initiales teintées, repli doré), intégrée à la liste des comptes du dashboard
> et à la page Connexions ; badge de sync (source lisible + dernière synchro
> relative via `source`/`source_timestamp`) sous le solde. Util `formatRelativeTime`
> ajouté. Les logos officiels ne sont pas embarqués (droits) — le registre est
> extensible si l'on veut y déposer de vrais assets plus tard.

- **Logos de banques** sur comptes et transactions (à la Picsou `bank-logos`) : petit référentiel statique de logos (BforBank, LCL, + banques EB connectées), fallback initiale dans un cercle doré. Affichage dans la liste des comptes, la page Connexions (chantier 1.3) et éventuellement les lignes de transactions.
- **Badges de statut de sync** sur les comptes : dernière synchro (`last_import_at` du chantier 1.1) + source (Enable Banking / Linxo / manuel), en `text-micro` sous le solde.

**Vérification** : Storybook des nouveaux composants, jest-axe (contraste des badges), revue visuelle.

---

## E. Pistes futures (non retenues, pour mémoire)

- **Sécuriser le déclencheur de sync** : `public/src/hooks/useSyncTransactions.ts` stocke un PAT GitHub en localStorage pour appeler l'API `dispatches`. À remplacer à terme par une Cloud Function authentifiée qui déclenche le `repository_dispatch` (le PAT reste côté serveur). Faiblesse de sécurité réelle mais non prioritaire (app mono-utilisateur).
- **Sidecars scraping hors-PSD2** (façon `tr-auth`/`bourso-auth` de Picsou) pour Livret A/PEA/assurance-vie : bloquant structurel — Picsou a un serveur always-on qui maintient des sessions Playwright vivantes ; l'infra GitHub Actions ne le permet pas (2FA interactive à chaque run). À reconsidérer seulement si un serveur personnel (NAS, Raspberry Pi) entre en jeu.
- **Mode clair / thème système** : écarté — AURUM reste dark-only.

---

## Ordre d'exécution proposé

1. **Chantier 1** (connexions in-app) — le plus de valeur, découpable en 1.1 → 1.2 → 1.3 → 1.4 (chaque étape shippable seule grâce au fallback env).
2. **Chantier 2** (qualité UI/UX) — indépendant du chantier 1, peut être mené en parallèle par lots.
3. **Chantier 3** (touches design) — dépend de 1.1 pour `last_import_at`, sinon indépendant.

Chaque chantier = une branche/PR autonome, tests verts avant et après (`npm test`, `npm run lint`, `pytest`), conformément à la règle des plans précédents.
