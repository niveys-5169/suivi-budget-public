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
- Création : compte autorisé, `byEmail` égal à l'email du jeton, `at` égal à
  l'heure du serveur.
- Modification et suppression : refusées à tous.

### Écriture

- `utils/auditLog.ts` (pur) : calcul des écarts entre l'état précédent et le
  patch, libellés d'affichage.
- `services/auditLog.ts` : `audited(specs, write)` lit l'état précédent dans le
  cache local Firestore, exécute l'écriture métier, puis enregistre les lignes ;
  `recordAudit(specs)` enregistre seulement.
- Points instrumentés : `services/transactionRepository.ts`,
  `hooks/recurrencesService.ts`, `context/BudgetContext.tsx`, `api/budgets.ts`,
  `hooks/useBudgetExclusions.tsx`, `components/budgets-v2/RAVEditor.tsx`.

### Limites assumées

- Le journal est écrit **juste après** l'écriture métier, pas dans la même
  opération atomique : garder les appels `updateDoc`/`setDoc` existants évite de
  réécrire chaque point d'écriture. Un échec du journal est consigné en console
  et ne bloque jamais l'action de l'utilisateur.
- L'ancienne valeur vient du cache local : absente du cache, la ligne ne porte
  que la nouvelle valeur.
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
  usurpation d'email refusée, modification et suppression refusées).
- Unitaires : écarts et libellés (`utils/auditLog`), service (`audited`,
  `recordAudit`), page Journal.
