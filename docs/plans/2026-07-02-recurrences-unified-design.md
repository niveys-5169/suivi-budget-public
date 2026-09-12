# Plan : Unification de la gestion des récurrences (abonnements)

> **Pour l'IA qui code.** Ce document est auto-suffisant. Exécute phase par
> phase (P1 → P5), dans l'ordre. Chaque phase est livrable indépendamment.
> Après **chaque phase** : `npm run typecheck`, `npm run lint`, `npm test`,
> `npm run build` — tout doit rester vert (règle « Zero Warning »).
> Terminologie : **« Récurrences »** partout dans l'UI (remplace « Abonnements »).

> **Amendement post-P5 (Phase 6, juillet 2026).** À l'usage réel, deux volets
> de ce plan se sont révélés inutiles : le support multi-fréquence
> (`weekly`/`quarterly`/`yearly`) — l'utilisateur n'a que des récurrences
> mensuelles — et le système de suggestions détectées automatiquement — trop
> bruyant sur l'historique ancien. Les deux ont été retirés ; voir
> `docs/ARCH_STATE.md` (section Récurrences unifiées) pour l'état final
> réellement en production. Ce document reste tel quel comme trace de la
> conception initiale.

---

## 1. Contexte & diagnostic

### 1.1 Deux systèmes parallèles coexistent aujourd'hui

**Système A — Récurrences déterministes** (collection Firestore `recurrences`,
type `Recurrence` dans `banking.types.ts:187`) :

| Aspect   | Implémentation                                                                                                                                                       |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Création | Manuelle, depuis une transaction (`TransactionFormModal` → `createRecurrenceFromTransaction`)                                                                        |
| Modèle   | `label`, `category`, `expectedAmount`, `dayOfMonth`, `active`, `approvedMonths` (map `YYYY-MM` → `{txId, amount, date, approvedAt}`)                                 |
| Matching | `utils/matchRecurrence.ts` : catégorie identique **stricte** + montant ±20 % + jour ±4                                                                               |
| Écrans   | `AurumRecurringPage` (« Gérer mes abonnements »), onglet Récurrences d'Analyse (`enrichRecurrences`), badges transactions (desktop + mobile), `MLinkRecurrenceModal` |
| Service  | `hooks/recurrencesService.ts`                                                                                                                                        |

**Système B — Détection heuristique** (collection `recurring_expense_settings`,
type `RecurringExpense` dans `banking.types.ts:198`) :

| Aspect           | Implémentation                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Création         | Auto-détection sur l'historique (`detectRecurringCandidates` : groupement par libellé normalisé + fuzzy merge, ≥ 2 mois distincts)                                                 |
| Modèle           | `key` (slug du libellé), `status` accepted/pending/rejected, `aliases`, `customAmount/Label/Category`, `monthOverrides` (skip / linkedTxId)                                        |
| Écrans / logique | `useRecurring` → alertes (`useAlerts`), prévisionnel (`useCashflowForecast`), provisions RAV (`ravCalculations`, `RAVEditor`, `useDashboard`, `useExpenseBudget`, `budgetHelpers`) |
| Service          | `hooks/recurringService.ts`                                                                                                                                                        |

### 1.2 Problèmes concrets

1. **Duplication conceptuelle** : deux collections, deux moteurs de matching,
   deux mécanismes de liaison mensuelle (`approvedMonths` vs `monthOverrides`),
   deux services, deux vocabulaires. Toute évolution doit être faite deux fois
   (ou est faite une fois → divergence).
2. **Le prévisionnel mélange les deux mondes** : `useCashflowForecast` prend les
   dépenses du système B et les revenus du système A, avec un hack de
   déduplication label/catégorie (`useCashflowForecast.tsx:40-71`) fragile.
3. **Matching aveugle aux hausses de prix** : le montant ±20 % de
   `findRecurrenceMatch` absorbe silencieusement les augmentations au lieu de
   les signaler.
4. **Mensuel uniquement** : le système A ne connaît que `dayOfMonth`. Aucune
   récurrence annuelle (assurance, impôts), trimestrielle ou hebdomadaire.
5. **Clés instables côté B** : `key` = slug du libellé → un changement de
   libellé bancaire crée un doublon « pending » (d'où la mécanique de
   `mergeCandidate`, un patch sur un défaut de conception).
6. **Aucune édition** : `AurumRecurringPage` permet approuver/supprimer mais
   pas de modifier montant attendu, jour, catégorie ou libellé.

### 1.3 Comment font les apps bancaires premium

Benchmark (Bankin', Revolut, N26, Copilot Money, Emma, Rocket Money) — les
invariants du segment :

- **Une seule entité « Abonnement/Récurrent »** : marchand, montant attendu,
  fréquence (hebdo/mensuel/trimestriel/annuel), prochaine échéance, statut.
- **La détection ne fait que suggérer.** L'app propose (« Est-ce un
  abonnement ? ») ; l'utilisateur confirme ou ignore **une fois**. Une fois
  confirmé, l'entité vit sa vie : chaque cycle, les transactions s'y rattachent.
- **Auto-rattachement confiant, suggestion sinon** : si le libellé est déjà
  connu (alias) et le montant plausible → lien automatique ; sinon badge
  « suggestion » à valider. Chaque lien manuel **enrichit les alias** (le
  système apprend).
- **Vue calendrier « À venir »** : échéances des 30 prochains jours + total
  mensuel, alimentant directement le prévisionnel.
- **Alertes utiles** : hausse de prix (« Netflix +2 € »), échéance en retard.

C'est exactement l'architecture cible : **une entité, un moteur, plusieurs vues**.

---

## 2. Architecture cible

### 2.1 Modèle de données unique (collection `recurrences`, étendue)

```ts
// banking.types.ts — remplace Recurrence et, à terme, RecurringExpense
export type RecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurrenceOccurrence {
  txId: string;
  amount: number;
  date: string; // ISO YYYY-MM-DD
  approvedAt: number;
}

export interface Recurrence {
  id: string;
  label: string;
  /** Libellés normalisés (normalizeLabel) reconnus pour l'auto-match. */
  aliases: string[];
  category: string;
  expectedAmount: number; // signé (négatif = dépense, positif = revenu)
  frequency: RecurrenceFrequency; // absent en base = 'monthly' (compat)
  /** Date d'ancrage ISO : référence du cycle (jour de prélèvement, mois de l'annuel…). */
  anchorDate: string;
  /** Dérivé d'anchorDate, écrit en double pendant la transition (compat lecture
   *  des consommateurs non encore migrés) ; supprimé en P5. */
  dayOfMonth: number;
  active: boolean; // false = en pause (conservé pour compat, pas de rename)
  source: 'manual' | 'auto'; // auto = créée depuis une suggestion
  /** Liaisons par période. Clé = periodKey (voir 2.2). Nom Firestore conservé. */
  approvedMonths: Record<string, RecurrenceOccurrence>;
  /** Périodes explicitement ignorées ("pas ce mois-ci"). */
  skippedPeriods: string[];
  createdAt: Timestamp;
}
```

**Décisions et alternatives rejetées :**

- **On garde la collection `recurrences` et le champ `approvedMonths`** tels
  quels (pas de renommage Firestore) : zéro migration de données pour
  l'existant, les documents actuels restent valides (`frequency` absent →
  `'monthly'`, `anchorDate` dérivée de `dayOfMonth`). _Rejeté : nouvelle
  collection « v2 » — coût de migration sans bénéfice._
- **`skippedPeriods: string[]`** séparé plutôt qu'un état `skipped` dans
  `approvedMonths` : écriture triviale (`arrayUnion`), pas de mutation de la
  structure existante. _Rejeté : union type dans la map — migration + lecture
  plus complexe._
- **`anchorDate` remplace `dayOfMonth`** comme source de vérité (le jour du
  mois en est dérivé pour le mensuel). C'est ce qui rend les fréquences
  non-mensuelles possibles sans champ supplémentaire. `dayOfMonth` reste écrit
  en double pendant la transition (P2), supprimé en P5.
- **`RecurringExpense` disparaît à terme** ; la collection
  `recurring_expense_settings` est gelée puis décommissionnée (P4/P5).

### 2.2 Un moteur pur unique : `utils/recurrenceEngine.ts`

Toute la logique métier dans **un seul module de fonctions pures** (testables
sans Firestore ni React) :

```ts
// Clé de période selon la fréquence
getPeriodKey(freq, date: string): string
// monthly → 'YYYY-MM' (compat totale avec les clés existantes)
// quarterly → 'YYYY-Q1'..'YYYY-Q4' ; yearly → 'YYYY' ; weekly → 'YYYY-W##'

// Date attendue d'une récurrence pour une période donnée (clamp fin de mois)
getExpectedDate(rec: Recurrence, periodKey: string): string

// Périodes attendues dans une fenêtre (alimente « À venir » et le prévisionnel)
getUpcomingOccurrences(rec: Recurrence, from: string, days: number): { periodKey, expectedDate }[]

// Équivalent mensuel du montant (weekly ×52/12, quarterly ÷3, yearly ÷12)
toMonthlyAmount(rec: Recurrence): number

// Matching à 2 niveaux — remplace findRecurrenceMatch.
// PRÉREQUIS ÉLIMINATOIRE aux deux niveaux : catégorie identique
// (insensible à la casse, trim — invariant conservé de l'existant).
//  1. alias exact (normalizeLabel(tx.libelle) ∈ rec.aliases) + montant ±30 % → match fort
//  2. score : similarité de libellé + montant ±20 % + proximité de date
//     (fenêtre proportionnelle à la fréquence, chacune strictement inférieure à
//     son propre cycle pour éviter tout chevauchement inter-occurrences :
//     ±2j hebdo, ±4j mensuel, ±10j trimestriel, ±20j annuel)
matchTransaction(rec: Recurrence, txs: Transaction[], periodKey: string): { tx, confidence: 'strong' | 'weak' } | null

// État d'une récurrence pour une période (remplace enrichRecurrences + la logique d'AurumRecurringPage)
computePeriodState(rec, periodKey, txs, today): {
  state: 'paid' | 'skipped' | 'pending' | 'overdue';
  effectiveAmount: number;
  occurrenceDate: string;
  match?: { tx; confidence };
}
```

**Apprentissage** : quand l'utilisateur lie manuellement une transaction, le
service ajoute `normalizeLabel(tx.libelle)` aux `aliases` (`arrayUnion`). Le
match devient « fort » aux cycles suivants → auto-rattachement à la Bankin'.

### 2.3 Un hook unique : `hooks/useRecurrences.ts`

Remplace à terme `useRecurring` + `useRecurrenceReconciliation` +
la logique locale d'`AurumRecurringPage` et d'`AnalyseSection` :

```ts
useRecurrences(monthKey) => {
  recurrences,            // enrichies via computePeriodState pour la période vue
  upcoming,               // échéances 30 j (toutes fréquences)
  monthlyTotal,           // Σ toMonthlyAmount des dépenses actives
  suggestions,            // candidats de détection non encore traités (voir 2.4)
  linkedTxToRecurrence,   // badges transactions (API conservée)
  candidateTxToRecurrence,
  actions: { link, unlink, skip, unskip, pause, resume, edit, remove,
             acceptSuggestion, ignoreSuggestion }
}
```

Le service Firestore reste `hooks/recurrencesService.ts`, complété
(`updateRecurrence`, `skipRecurrencePeriod`, `addRecurrenceAlias`…).

### 2.4 La détection devient un simple fournisseur de suggestions

`detectRecurringCandidates` est conservé mais recadré :

- Il **infère la fréquence** (médiane des intervalles entre occurrences :
  ~7 j → weekly, ~30 j → monthly, ~91 j → quarterly, ~365 j → yearly) et
  propose `expectedAmount` (médiane, plus robuste que la moyenne) et
  `anchorDate` (dernière occurrence).
- Sont exclus les candidats dont le libellé normalisé matche les `aliases`
  d'une récurrence existante, et ceux listés dans un document unique
  `settings/recurrenceSuggestions` (`{ ignoredKeys: string[] }`).
- **Accepter** une suggestion crée un document `Recurrence` (`source: 'auto'`,
  alias = libellés du groupe détecté). **Ignorer** ajoute la clé à
  `ignoredKeys`. Les statuts pending/accepted/rejected du système B
  disparaissent : une suggestion n'est pas une entité persistée.

### 2.5 Alertes premium (peu mais utiles)

Dans `computeAlerts` / `useAlerts`, alimentées par `useRecurrences` :

1. **Échéance en retard** : `state === 'overdue'` (date attendue dépassée,
   aucun lien ni skip) — existe déjà, conservé.
2. **Hausse de prix** : montant lié du dernier cycle > `expectedAmount` de
   plus de 10 % → alerte « Netflix : 17,99 € au lieu de 15,99 € » avec action
   « Mettre à jour le montant attendu ».
3. **Nouvelles suggestions** : `suggestions.length > 0` (remplace l'alerte
   « pending » actuelle de `useAlerts`).

### 2.6 Flux consommateurs après unification

```
                      ┌──────────────────────────┐
   Firestore          │  utils/recurrenceEngine  │   (fonctions pures + tests)
   `recurrences` ───► │  hooks/useRecurrences    │
   (onSnapshot via    └────────────┬─────────────┘
    GlobalDataContext)             │
        ┌──────────────┬───────────┼────────────┬──────────────┬───────────┐
        ▼              ▼           ▼            ▼              ▼           ▼
  Page Récurrences  Analyse   Badges tx     Prévisionnel   Provisions   Alertes
  (À venir/Payées/  (onglet   (desktop +    (cashflow,     RAV/Budget   (retard,
   Suggestions)     Récurr.)   mobile)       toutes freq.)  (toMonthly)  hausse)
```

---

## 3. Plan de migration par phases

> Chaque phase est un incrément livrable. Règle **PWA & Web Parity**
> (`GEMINI.md`) : chaque changement d'UI est appliqué aux vues desktop
> (`components/dashboard/v2`, `components/analyse`) **et** mobile
> (`mobile/screens`, `mobile/components`).

### Phase 1 — Moteur pur + types (aucun changement de comportement)

- [ ] Étendre `Recurrence` dans `banking.types.ts` (champs optionnels :
      `frequency?`, `anchorDate?`, `aliases?`, `source?`, `skippedPeriods?`) ;
      `dayOfMonth` reste requis à ce stade.
- [ ] Créer `utils/recurrenceEngine.ts` : `getPeriodKey`, `getExpectedDate`,
      `getUpcomingOccurrences`, `toMonthlyAmount`, `matchTransaction`,
      `computePeriodState`. Les documents sans `frequency` sont traités
      `monthly` avec `anchorDate` dérivée de `dayOfMonth`.
- [ ] Réécrire `findRecurrenceMatch` et `enrichRecurrences` comme de simples
      façades sur le moteur (signatures conservées → aucun appelant modifié).
- [ ] Tests Vitest exhaustifs du moteur (`tests/utils/recurrenceEngine.test.ts`) :
      clés de période, clamp 31 → fin de mois, fenêtres de date par fréquence,
      match par alias vs score, catégorie divergente systématiquement rejetée,
      hausse de prix détectée.
- [ ] → vérifier : `typecheck` + `lint` + `test` + `build` verts ; les tests
      existants (`matchRecurrence.test.ts`, `useRecurrenceReconciliation.test.tsx`,
      `recurrencesService.test.ts`) passent **sans modification**.

### Phase 2 — Édition + fréquences + skip (côté système A)

- [ ] `recurrencesService.ts` : `updateRecurrence(id, patch)`,
      `skipRecurrencePeriod` / `unskipRecurrencePeriod` (arrayUnion/Remove),
      `addRecurrenceAlias(id, label)`. `createRecurrenceFromTransaction` écrit
      désormais `frequency: 'monthly'`, `anchorDate`, `aliases: [normalizeLabel(libelle)]`,
      `source: 'manual'` (+ `dayOfMonth` en double, compat).
- [ ] Modale d'édition d'une récurrence (libellé, montant attendu, catégorie,
      fréquence, date d'ancrage, pause) — réutiliser `components/shared/Modal.tsx`.
      Accessible depuis `AurumRecurringPage` et l'onglet Récurrences d'Analyse.
- [ ] `linkTxToRecurrence` (hook de réconciliation) appelle `addRecurrenceAlias`
      → apprentissage des libellés.
- [ ] Ajouter les états `skipped` et le bouton « Ignorer ce mois » sur les deux
      vues (desktop + mobile `MLinkRecurrenceModal` / `AnalyseScreen`).
- [ ] → vérifier : créer une récurrence annuelle de test, naviguer les mois,
      elle n'apparaît « attendue » que sur son mois d'ancrage ; skip/unskip
      persiste ; tests unitaires services (mocks Firestore comme
      `recurrencesService.test.ts`).

### Phase 3 — Suggestions unifiées dans la page Récurrences

- [ ] Recadrer `detectRecurringCandidates` : inférence de fréquence + médiane
      des montants + exclusion par alias existants et `ignoredKeys`
      (doc `settings/recurrenceSuggestions`).
- [ ] Créer `hooks/useRecurrences.ts` (cf. 2.3), qui expose aussi `suggestions`.
- [ ] `AurumRecurringPage` : sections **À venir / Payées / En pause /
      Suggestions** + total mensuel (`toMonthlyAmount`). Accepter → crée le doc
      `Recurrence` ; Ignorer → `ignoredKeys`. Parité mobile (`AnalyseScreen`).
- [ ] Renommer les libellés UI « Abonnements » → « Récurrences » (fr.ts / en.ts).
- [ ] → vérifier : une suggestion acceptée disparaît des suggestions et
      apparaît dans les récurrences actives avec ses alias ; une ignorée ne
      revient jamais ; test composant sur la page.

### Phase 4 — Bascule des consommateurs budget / prévisionnel / alertes

- [ ] `useCashflowForecast` : lit uniquement `useRecurrences`
      (`getUpcomingOccurrences` pour dépenses **et** revenus, toutes
      fréquences) — suppression du hack de déduplication.
- [ ] Provisions RAV (`ravCalculations`, `RAVEditor`, `useDashboard`,
      `useExpenseBudget`, `budgetHelpers`) : remplacer `recurringSettings` par
      les récurrences actives (`toMonthlyAmount`). Les récurrences unifiées
      couvrant aussi bien les dépenses que les revenus (`expectedAmount` signé),
      chaque consommateur filtre explicitement par sens (`< 0` pour les
      provisions de dépenses, `> 0` pour les revenus fixes) — jamais la liste
      brute. Adapter les tests (`budgetHelpers.test.ts`, `useCashflowForecast.test.tsx`).
- [ ] `useAlerts` / `computeAlerts` : alertes retard + hausse de prix +
      suggestions (cf. 2.5).
- [ ] **Script de migration one-shot** (`scripts/migrate_recurring_settings.py`,
      exécuté manuellement, cf. convention `scripts/migrate_budgets_v2.py`) :
      chaque `recurring_expense_settings` avec `status === 'accepted'` →
      document `Recurrence` (`source: 'auto'`, `aliases` repris,
      `expectedAmount` = `-abs(customAmount ∥ manualAmount)` — signe
      systématiquement forcé négatif quelle que soit la convention historique
      du champ source, `monthOverrides.linkedTxId` → `approvedMonths`,
      `skipped` → `skippedPeriods`) ; les `rejected` → `ignoredKeys`. Idempotent
      (skip si un doc avec même alias existe). En pratique, `label`/`category`/
      `avgAmount` ne sont jamais persistés pour les candidats détectés
      automatiquement (recalculés à la volée côté app) : sans montant
      exploitable, le candidat est laissé de côté plutôt que migré à 0 € — il
      réapparaît naturellement comme suggestion sur les mêmes transactions.
- [ ] → vérifier : avant/après migration, le total des provisions RAV et le
      prévisionnel 30 j sont identiques (tolérance d'arrondi) — consigner les
      deux valeurs dans le rapport de PR.

### Phase 5 — Décommission

- [ ] Supprimer `useRecurring`, `recurringService.ts` (sauf `normalizeLabel`
      et `getRecurringKey`, déplacés dans `recurrenceEngine.ts`),
      le type `RecurringExpense`, `recurringSettings` de `GlobalDataContext`.
- [ ] Supprimer l'écriture en double de `dayOfMonth` ; retirer les façades
      `findRecurrenceMatch`/`enrichRecurrences` si plus aucun appelant direct.
- [ ] Geler la collection `recurring_expense_settings` (règle Firestore en
      lecture seule, suppression différée après un mois d'observation).
- [ ] Mettre à jour `docs/ARCH_STATE.md` (section Récurrences unifiées).
- [ ] → vérifier : `grep -r "recurring_expense_settings\|RecurringExpense" public/src`
      ne retourne plus rien ; suite complète verte ; smoke test manuel desktop +
      PWA sur les 5 vues consommatrices.

---

## 4. Risques & garde-fous

| Risque                                                           | Garde-fou                                                                                                                                                             |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Régression du matching (extension aux fréquences non mensuelles) | Phase 1 isolée + tests golden sur les cas actuels ; la catégorie reste éliminatoire à tous les niveaux et l'auto-lien fort exige un alias exact, jamais le seul score |
| Divergence RAV/prévisionnel après bascule                        | Comparaison chiffrée avant/après en P4 (critère de succès explicite)                                                                                                  |
| Migration Firestore partielle                                    | Script idempotent, exécution manuelle, collection source gelée (pas supprimée)                                                                                        |
| Doublons revenus (récurrence + `ravConfig.provision_salaires`)   | La règle de préséance vit dans `useRecurrences` (une récurrence de revenu masque la provision RAV de même libellé), plus dans le hook de forecast                     |
| Casse mobile (parité PWA)                                        | Chaque phase liste explicitement ses touchpoints mobiles ; vérification croisée en fin de phase                                                                       |

## 5. Ce que ce plan ne fait volontairement pas

- Pas de Cloud Function de matching côté serveur : le volume (mono-utilisateur,
  snapshot temps réel déjà en place) ne le justifie pas.
- Pas de gestion multi-devises ni de « négociation d'abonnement » (features
  Rocket Money hors périmètre).
- Pas de refonte visuelle : la page Récurrences garde le design AURUM actuel,
  seules les sections et actions évoluent.
