# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format s'inspire de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/).

## [Unreleased] - Semaine du 27/07/2026

### Added

- **Reparse Gmail câblé** : la page « Reparse Gmail » écrivait des jobs
  qu'aucun backend ne lisait ; `src/importer.py` consomme désormais
  `reparse_jobs` (reparse par message, « Scanner tout ») et le filtre
  d'exclusion `gmail_excluded` (`7fa237c`).
- `scripts/cleanup_duplicate_ids.py` : nettoyage (dry-run par défaut) des
  documents Firestore dupliqués par le changement d'ID de transaction,
  avec report du travail utilisateur (pointé/commentaire/mois) sur le
  document conservé (`d578f6e`).
- `scripts/backfill_linxo_pending.py` : ré-ouvre au reprocessing les mails
  Linxo « en attente » traités avant le correctif de réconciliation
  (`b6d7648`).
- `scripts/check-npm-audit.mjs` : enveloppe `npm audit` d'une liste
  d'exceptions justifiées et datées, avec échéance de réexamen (`98a81c5`).
- Bibliothèque de primitives UI **`public/src/ui/`** (Text, Amount, Card,
  List/ListItem/Tile, Button/IconButton, Field/Input/Select/Textarea/Switch,
  Sheet/Modal, NavBar/Toolbar/TabBar/SegmentedControl, Screen, Stack,
  Separator, Section, Badge, Chip, ProgressBar, EmptyState, Skeleton),
  consommée par les écrans desktop et mobile pour qu'ils ne puissent plus
  diverger visuellement (`0894b9e`).
- `scripts/check-design-system.mjs` : dix compteurs à cliquet (rayons,
  majuscules, letter-spacing, tailles en dur, espacements hors grille, hex,
  boutons/champs bruts, glass-panel), branchés CI + pre-commit, remplace
  `check-arbitrary-radius.mjs` (`ca6829e`, resserré au fil des vagues
  suivantes).

### Changed

- **Refonte du Design System AURUM v3** (six vagues) : source de tokens
  unique (`public/src/ui/tokens.css`/`tokens.ts`), navigation et coquille
  unifiées entre desktop et mobile (`TabBar`, `NavBar`, `SegmentedControl`,
  `MonthNavigator`), tous les écrans alignés sur les primitives (Réglages,
  Transactions inclus), suppression du module clair « JourX » et des alias
  de tokens hérités (`ca6829e`, `0894b9e`, `9054f3d`, `0c38fc1`, `bef28c0`,
  `e21b39d`).
- **Récurrences** : la couche métier est unifiée derrière une façade unique
  `hooks/useRecurrences.ts` et un automate d'état unique (`approved | matched
| skipped | expected | overdue`), mettant fin à la divergence d'affichage
  entre `/recurring` et l'onglet Analyse (désormais lecture seule) (`2e1592d`).
- **Mode compact** : couvre désormais réellement les listes de transactions
  (desktop et mobile), via cinq nouveaux points d'ancrage sur le rythme
  vertical, le padding de carte, la barre de titre et les en-têtes de groupe
  (`d777da6`).
- **Commentaire de transaction** : affiché dans la ligne de métadonnées
  (« catégorie • compte • commentaire »), tronqué avec `title` au survol,
  au lieu d'un bloc dépliable qui cassait l'alignement de la colonne
  (`6b42807`).
- **Import** : `_transaction_id` est désormais préfixé par le compte pour
  éviter les collisions inter-comptes ; les documents existants gardent leur
  ancien ID (rétro-compatible, sans migration) (`eabf717`).
- **CI** : `frontend-ci.yml`/`e2e.yml`/`test-reconciliation.yml` peuvent
  tourner sur un runner self-hosted via la variable de dépôt `CI_RUNNER`
  (repli sur le runner GitHub-hosted si non définie) (`bb5f821`).
- Cadence de `linxo-poll.yml` : passage de 30 à 60 minutes (`ab9e9d8`).
- Dépendances resserrées suite à l'audit npm : `postcss`, `fast-uri`,
  `js-yaml`, `protobufjs` (`98a81c5`).

### Fixed

- **Incident du 28/07 (import Gmail)** : 286 transactions dupliquées créées
  par l'interaction de deux changements de la PR #701 (ID préfixé par
  compte + dédup limitée à 60 jours côté reparse). Corrigé par un
  préchargement unique des deux formats d'ID et une comparaison à tout
  l'historique en reparse ; 286 doublons nettoyés en production (`d578f6e`).
- Règle de nettoyage des doublons : ne compare plus le libellé (renommable
  par l'utilisateur) mais l'existence d'un document à l'ID hérité
  déterministe sur le même compte — 271 doublons supplémentaires détectés
  et supprimés en production après correction (`4b25944`).
- Opérations Linxo « en attente » sans contrepartie notifiée à nouveau :
  elles n'étaient plus importées du tout depuis `95cb738`, alors que la
  majorité des marchands (assurance, abonnements…) ne renotifie jamais
  l'opération réalisée. La réconciliation en attente/réalisée est
  maintenant faite explicitement dans `dedup.reconcile_pending` (`b6d7648`).
- Enable Banking : les écritures en statut `PDNG` (en attente) sont de
  nouveau ignorées à l'import pour éviter les doublons à la comptabilisation
  (régression réintroduite silencieusement par un commit antérieur)
  (`eabf717`).
- Espacements écrasés sur toute l'application (PWA iPhone) : une règle
  `* { margin: 0; padding: 0 }` hors `@layer` dans `style.css` neutralisait
  les utilitaires Tailwind v4 quelle que soit leur spécificité (`c477a9a`).
- « Audit Flux » inaccessible depuis Analyses sur mobile : `AnalyseScreen`
  ne câblait pas `onTransactionClick` vers `MCategoryDrillDown` (`c477a9a`).
- Audit npm en échec sans dégrader les dépendances existantes : correctifs
  ciblés (voir Changed) + liste d'exceptions justifiées pour les deux failles
  restantes sans correctif publié compatible (`react-router`,
  `brace-expansion`) (`98a81c5`).

### Removed

- **Intégration Enable Banking (Open Banking / PSD2) retirée** en attendant
  le support de BforBank : suppression de `src/eb_importer.py`,
  `src/enable_banking_client.py` (+ copie `functions/`), des fonctions Cloud
  `eb_auth_start` / `eb_auth_callback` et des accès sessions/pending-auth de
  `firebase_db.py`, des scripts `eb_setup.py` /
  `migrate_eb_sessions_to_firestore.py`, du workflow `eb-import.yml` et de son
  étape dans `main.yml`. Côté front : hook `useBankConnections`, page
  « Connexions bancaires », bannière `EbExpiryBanner`, route `/connexions` et
  libellés de source associés. Linxo (e-mail) et Tronity restent les sources
  d'import. Dépendance `PyJWT` retirée (utilisée uniquement par EB).
  `scripts/cleanup_eb_collections.py` (dry-run par défaut) purge les
  collections Firestore orphelines `eb_sessions` / `eb_pending_auth`.
- `src/history_importer.py` (pont Excel/Apps Script archivé, ne démarrait
  plus) et l'entrée de workflow `import_historique` associée (`7fa237c`).
- `utils/recurrenceProcessing.ts`, `utils/matchRecurrence.ts`,
  `hooks/useRecurrenceReconciliation.ts`,
  `analyseAggregations.enrichRecurrences` et le type `RecurringItemEnriched`,
  remplacés par la façade unique de récurrences (`2e1592d`).
- Module `components/new-ui/` (« JourX », thème clair) et son toggle
  (`bef28c0`).
