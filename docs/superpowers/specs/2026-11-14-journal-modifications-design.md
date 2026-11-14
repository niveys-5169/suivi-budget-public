# Journal des modifications — conception (14 novembre 2026)

## Besoin

L'app est désormais utilisée par plusieurs comptes (voir `access_allowlist`
dans `firestore.rules`). Il faut savoir **qui a modifié quoi** sur les
transactions, les budgets et les récurrences, et le consulter dans l'app.

## Décisions validées

- **Périmètre** : transactions, budgets, récurrences. Le reste de l'app
  (patrimoine, règles, réglages) n'est pas journalisé.
- **Consultation** : page « Journal » (`/journal`, desktop et PWA) et rappel
  des dernières modifications dans la fiche d'une transaction.
- Les imports automatiques (Linxo, Enable Banking, Tronity) passent par
  l'Admin SDK, sans compte utilisateur : ils ne sont pas journalisés.

## Approche

Chaque écriture du front ajoute un document dans la collection `audit_log`.
Écartés : un champ « modifié par » sur chaque document (un seul auteur gardé,
suppressions perdues) et un déclencheur serveur (il ignore l'auteur).

### Document `audit_log/{id}`

| Champ     | Contenu                                                    |
| --------- | ---------------------------------------------------------- |
| `at`      | Horodatage serveur                                         |
| `byEmail` | Email du compte connecté (`byUid` : son UID)               |
| `domain`  | `transaction` \| `budget` \| `recurrence`                  |
| `action`  | `create` \| `update` \| `delete`                           |
| `path`    | Chemin du document modifié (`docId` : son identifiant)     |
| `label`   | Libellé lisible (libellé de transaction, catégorie…)       |
| `changes` | Liste `{ field, from?, to? }`, valeurs réduites à du texte |

### Règles Firestore

- Lecture : comptes autorisés.
- Création : compte autorisé, `byEmail` et `byUid` égaux à ceux du jeton, `at`
  égal à l'heure du serveur, seules les clés du tableau ci-dessus, domaine et
  action connus, `label` ≤ 300 caractères, `path` et `docId` ≤ 500, `changes`
  liste d'au plus 50 éléments (bornes aussi appliquées par le service).
- Modification et suppression : refusées à tous.

### Écriture

- `utils/auditLog.ts` (pur) : calcul des écarts entre l'état précédent et le
  patch, libellés d'affichage.
- `services/auditLog.ts` : `audited(specs, write)` lit l'état précédent dans le
  cache local Firestore, lance l'écriture métier, met aussitôt les lignes en
  file puis attend les deux.
- Points instrumentés : `services/transactionRepository.ts`,
  `hooks/recurrencesService.ts`, `context/BudgetContext.tsx`, `api/budgets.ts`,
  `hooks/useBudgetExclusions.tsx`, `components/budgets-v2/RAVEditor.tsx`,
  `hooks/useAdvancedSettings.ts` (reste-à-vivre), `components/advanced/FusionPage.tsx`.

### Limites assumées

- Le journal n'est pas écrit dans la même opération atomique que l'écriture
  métier : garder les appels `updateDoc`/`setDoc` existants évite de réécrire
  chaque point d'écriture. La ligne est mise en file juste après le lancement de
  l'écriture métier, sans attendre l'accusé de réception du serveur : une
  modification faite hors ligne est journalisée même si l'app est fermée avant le
  retour du réseau. Revers : si le serveur rejette l'écriture métier, une ligne
  peut exister pour un changement qui n'a pas eu lieu. L'erreur métier remonte
  toujours ; un échec du journal est consigné en console et ne bloque jamais
  l'action de l'utilisateur.
- Journal déclaratif : un compte autorisé qui écrit hors de l'app (console,
  SDK) peut modifier les données sans ligne de journal.
- L'ancienne valeur vient du cache local : absente du cache, la ligne ne porte
  que la nouvelle valeur.
- Exclusions voulues : crédits EDF automatiques liés aux recharges, alias appris
  d'une récurrence (`addRecurrenceAlias`), préférences de catégories.
- Réglages privés par compte : `users/{uid}/**` et `user_settings/{uid}` ne sont
  accessibles qu'au compte autorisé dont c'est l'UID.
- L'identifiant d'un document `access_allowlist` doit être l'email exactement en
  minuscules (comparaison stricte avec l'email du jeton).
- Pas d'historique rétroactif.

### Lecture

- `hooks/useAuditLog.ts` : `useAuditLog(max)` (dernières lignes) et
  `useDocumentAudit(path)` (lignes d'un document).
- `components/journal/JournalPage.tsx` : liste, filtres par personne et par
  domaine, bouton « Voir plus ».
- `components/journal/TransactionAuditTrail.tsx` : dernières modifications dans
  `TransactionFormModal` (partagée desktop/PWA).

## Tests

- Règles : `tests/rules/firestore.rules.test.ts` (lecture, création valide,
  usurpation d'email ou d'UID refusée, clés, domaine, action et bornes
  contrôlés, modification et suppression refusées, réglages privés par compte).
- Unitaires : écarts et libellés (`utils/auditLog`), service (`audited`),
  lecture (`useAuditLog`), page Journal.
