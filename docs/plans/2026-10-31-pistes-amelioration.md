# Pistes d'amélioration — UX / UI / frontend / backend / architecture

## Contexte

Revue d'un corpus de retours terrain (≈ 90 tickets récents d'une application de
finances personnelles comparable : agrégation bancaire, budget, patrimoine) pour en
extraire ce qui s'applique à Suivi-Budget. Chaque piste est croisée avec l'état
réel du dépôt (inventaire du code au 31/10/2026). Ce qui est déjà couvert
(connexions Enable Banking in-app, logos banques, badges de sync, design system
unifié, valorisation immobilière, IA de catégorisation, PWA offline) est écarté.

Implémentation lot par lot (une PR par lot), en commençant par le lot 1.

> **Périmètre retenu** : lot 1 complet, lot 2 = **2.4 uniquement**, lot 3 (3.5 reporté).

---

## Lot 1 — Fiabilité de l'affichage (quick wins, risque faible)

### 1.1 Dates calendaires sans dérive de fuseau — **priorité haute**

- **Constat** : 61 `new Date(<chaîne>)` dans 32 fichiers, dont `utils/recurrenceEngine.ts` (5),
  `api/consumption.ts` (7), `WealthEvolutionBudgetChart.tsx` (7). Aucun helper de parsing
  « date seule » ; la suite Vitest ne fixe aucun `TZ`. Un `YYYY-MM-DD` est lu en UTC minuit →
  décalage d'un jour possible sur bornes de cycle, échéances de récurrences, regroupements par jour.
- **Action** :
  1. Écrire d'abord des tests qui tournent sous `TZ=Europe/Paris` **et** `TZ=America/New_York`
     (bornes de cycle, jours de début 28–31, février, passages DST 29/03 et 25/10, échéance « le 4 »).
  2. Ajouter `parseCalendarDate` / `toCalendarKey` dans `public/src/utils/date.ts` (composants
     année/mois/jour, jamais de conversion UTC↔local), migrer `recurrenceEngine` et le cycle budget
     en premier, puis les autres appelants.
  3. Un seul helper partagé pour « cycle en cours » et « prochaines échéances » (les deux cartes
     doivent toujours concorder).
  4. Compteur à cliquet dans `scripts/check-design-system.mjs` sur `new Date(` + chaîne.
- **Backend** : vérifier que `scheduled_patrimoine_snapshot_daily` (00:05) et les snapshots
  sont datés en Europe/Paris et non en UTC serveur.

### 1.2 Formatage FR centralisé

- **Constat** : `lib/formatters.ts` est déjà bâti sur `Intl.NumberFormat`, mais 27 fichiers
  utilisent `toFixed(` dont plusieurs `…toFixed(0)}%` (`BucketDrillDown`, `CategoryDrillDown`,
  `AnalyseSimplifiedView`, `WealthEvolutionTable`, `LinkRecurrenceModal`) → « 8.3% » au lieu de « 8,3 % ».
- **Action** : ajouter `formatPercent`, `formatCompactCurrency` (graduations d'axes Recharts),
  `formatCount` avec `Intl.PluralRules` ; migrer les appelants ; espace insécable avant `%`, `€`, `:` ;
  vérifier le rendu de U+202F avec la police des montants ; test unitaire qui fige les sorties exactes ;
  compteur à cliquet `toFixed(` dans `check-design-system.mjs`.

### 1.3 Aucune zone blanche : états vides systématiques

- **Constat** : `shared/EmptyState.tsx` existe mais n'est utilisé que dans 8 fichiers.
- **Action** : inventaire des listes/cartes pouvant être vides (transactions filtrées, comptes sans
  opérations, récurrences, notifications, drilldowns analyse, mobile) ; chaque cas = message
  « quoi / pourquoi » + action suivante. Règle ajoutée à `DESIGN_SYSTEM.md`.

### 1.4 Chargements et redirections dans le shell

- **Constat** : `AppRouter.tsx:43` `<Suspense fallback={null}>` → cadre vide au démarrage/bascule
  desktop↔mobile ; `MainApp.tsx:191` `RouteSpinner` générique.
- **Action** : fallback = shell (sidebar/bottom nav) + placeholder neutre (titre + bloc), affiché
  après ~200 ms pour éviter le flash ; 404 rendue dans le layout avec action « Retour au tableau de bord ».

### 1.5 Un libellé = une définition (cohérence des totaux)

- **Action** : auditer « Dépenses / Sorties / Revenus / Épargne / Reste à vivre » entre dashboard,
  budget, analyse, mobile ; un seul périmètre par libellé, sinon renommer (ex. « Répartition du revenu »
  pour une vue incluant virements internes et épargne). Ne jamais étiqueter le non-dépensé « Épargne ».
  Test : pour un jeu de transactions fixe, les cartes affichant le même libellé renvoient le même montant.

### 1.6 Alignement et petits écrans

- Lignes de catégories : réserver l'emplacement du chevron même si la ligne n'est pas cliquable
  (montants et barres alignés).
- Passe 390 px : débordements de contrôles (en-têtes, onglets, réglages), dernière ligne masquée par
  la bottom nav (padding bas + safe-area).

---

## Lot 2 — Fonctionnalité retenue (2.4 uniquement)

> Décision utilisateur : revenus du capital prévisionnels, objectifs d'épargne, import CSV/OFX et
> refonte de la performance patrimoine sont **écartés** pour ce cycle.

### 2.4 Aperçu à blanc des règles de catégorisation

- Avant d'enregistrer une règle (`AurumRulesPage` / `RulesPage`) : liste des transactions qui seraient
  recatégorisées, avec avant/après. Évite les règles trop larges.
- Réutiliser le moteur de correspondance déjà employé par l'application des règles (à localiser dans
  `useRules` / `auto_categorize_backend.py`) en mode pur, sans écriture ; fonction testée unitairement.

---

## Lot 3 — Robustesse backend & architecture

### 3.1 Synchronisation bancaire tolérante

- Audit de `bank_sync.py` / `bank_pipeline.py` : l'échec d'un compte ne doit pas faire échouer
  les autres ; cause persistée dans `bank_sync_runs` et visible dans `/connexions`.
- Taxonomie d'erreurs distincte (consentement expiré / identifiants / fournisseur indisponible /
  transitoire-démarrage à froid) — ne jamais afficher « identifiants invalides » pour une erreur 5xx.
- Vérifier la non-journalisation des identifiants de session et jetons bancaires.
- Éditions manuelles jamais écrasées par une resynchro (déjà le principe des tombstones : ajouter
  un test de non-régression sur renommage côté banque).

### 3.2 Portabilité des données depuis l'UI

- Export complet (ZIP JSON + CSV de toutes les collections utilisateur) déclenché depuis les réglages
  via Cloud Function, réauthentification récente exigée, limité en fréquence. Aujourd'hui seulement
  `scripts/export_firestore.py`.

### 3.3 Honnêteté de l'écran sécurité

- `AurumProfilePage.tsx` affiche un libellé 2FA non implémenté : le retirer ou le remplacer par
  « sécurité gérée par votre compte Google ». Option ultérieure : liste/révocation des sessions.

### 3.4 Jeu de données déterministe + revue visuelle

- Fixtures déterministes (pas d'aléatoire) servant Storybook, e2e Playwright et une passe de captures
  2 viewports (1440×900, 390×844) : chaque page doit afficher des données ou un état vide, jamais un
  chargement infini. Base des vérifications des lots 1 et 2.

### 3.5 (Plus tard) Outils en lecture pour l'assistant IA

- Exposer à l'assistant (`useFinanceQA`) des outils typés en lecture seule (dépenses par catégorie,
  flux de trésorerie sur période, calendrier des récurrences, aperçu de règle) plutôt qu'un vidage de
  contexte ; toute écriture derrière une permission distincte et une confirmation.

---

## Écarté (hors usage réel ou hors infra)

Multi-membres/partage foyer, auto-hébergement conteneurisé, connecteurs par scraping de session,
langues supplémentaires, télémétrie (Sentry déjà présent), revenus du capital prévisionnels,
objectifs d'épargne, import CSV/OFX, refonte performance patrimoine.

## Ordre proposé

1. Lot 1.1 (dates) → 1.2 (formatage) → 1.3/1.4 (états vides, shell) → 1.5/1.6.
2. Lot 3.4 (fixtures) en appui dès le lot 1.
3. Lot 2.4 (aperçu des règles).
4. Lot 3.1–3.3, puis 3.5.

## Vérification (par PR)

- Lot 1.1 : tests rouges reproduisant le décalage sous deux `TZ`, puis verts ; `npm test` lancé avec
  la matrice de fuseaux en CI (`frontend-ci.yml`).
- `npm run lint`, `npx tsc --noEmit` zéro warning ; `node scripts/check-design-system.mjs` (nouveaux
  compteurs à cliquet uniquement décroissants).
- `pytest` pour toute modification `functions/` / `src/` (y compris test de miroir des modules).
- Playwright e2e + captures desktop/mobile sur fixtures déterministes pour les lots UI.
