# Plan : Couverture de Tests Complète pour le Noyau de Réconciliation

**Date :** 2026-04-19  
**Effort estimé :** 1-2 jours  
**Branche :** `claude/add-reconciliation-tests-UFzAJ`

---

## Goal

Couvrir le noyau de la réconciliation (Cloud Functions Python + UI/fingerprinting JS) avec une suite de tests unitaires et d'intégration, permettant de merger en confiance sans cycle "feature → 5 fix".

---

## Scope

### In Scope

1. **Tests unitaires Python (Cloud Functions)**
   - `balance_ingestion.py` : `ingest_proposed_balance_logic()` (cas nominal, erreurs, authentification, épargne)
   - `balance_reconciliation.py` : `run_balance_cross_validation_logic()` (divergence détectée, pas de divergence, épargne)
   - `reconciliation_actions.py` : `record_reconciliation_action_logic()` (validation, mise à jour)
   - `firebase_db.py` : `_run_with_backoff()`, `_stream_with_backoff()` (retry logic, mocking Firestore)

2. **Tests unitaires JavaScript/TypeScript**
   - `utils/balanceMapping.ts` : `buildBalanceMismatchFingerprint()` (collision, identique, champs manquants)
   - `components/ReconciliationReport.tsx` : rendu avec/sans divergences, avec épargne
   - `hooks/useBalances.tsx` : synchronisation réelle, erreurs de chargement

3. **Tests d'intégration légers**
   - Cycle e2e : ingestion → détection de divergence → action utilisateur → mise à jour Firestore
   - Utiliser Firebase Emulator Suite pour éviter dépendances extérieures en CI

4. **Intégration CI/GitHub Actions**
   - Ajouter job `test` dans workflow (bloque le merge si échoue)
   - Cibler uniquement fichiers de réconciliation pour limitation du temps d'exécution

### Out of Scope

- Tests pour autres modules (importers Tronity, EB, Linxo, Patrimoine)
- Test fonctionnel complet du UI (e2e Playwright/Cypress) — unitaires + intégration suffisent
- Performance/stress tests (load testing Firebase)
- Tests d'authentification Google OIDC/Firebase en vrai (mock)
- Modification des logiques métier — tests valident code existant uniquement

---

## Implementation Steps

### Phase 1 : Setup Infrastructure de Tests Python

**Step 1.1** — Créer base de test Python avec pytest + mocking

- **File :** Créer `tests/conftest.py` (fixtures partagées, mock Firebase)
- **Action :**
  - Importer `pytest`, `unittest.mock`, `firebase_admin`, `cloudevents`
  - Créer fixture `mock_firestore_client()` qui retourne mock Firestore
  - Créer fixture `mock_request()` pour HTTP requests
  - Créer fixture `mock_event()` pour CloudEvents
- **Dependencies :** Aucune

**Step 1.2** — Ajouter pytest à `functions/requirements.txt`

- **File :** `functions/requirements.txt`
- **Action :** Ajouter `pytest>=7.0`, `pytest-mock>=3.10`, `unittest-mock` (pour Python < 3.3 si nécessaire)
- **Dependencies :** Step 1.1

### Phase 2 : Tests Unitaires Python — Cloud Functions

**Step 2.1** — Tester `balance_ingestion.py`

- **File :** Créer `tests/test_balance_ingestion.py`
- **Action :**
  - Test nominal : payload valide, token OIDC valide → insertion Firestore réussie
  - Test erreur payload : champs manquants (account_id, balance_value) → HTTP 400
  - Test flag `isSavings=true` → insertion dans `savings_balances` au lieu `proposed_account_balances`
  - Test auth rejetée : OIDC token invalide ou expiré → HTTP 403
  - Utiliser `@patch` pour mock `verify_oauth2_token()`, Firestore, `functions.Request`
- **Dependencies :** Step 1.1, 1.2

**Step 2.2** — Tester `balance_reconciliation.py`

- **File :** Créer `tests/test_balance_reconciliation.py`
- **Action :**
  - Test nominal : 2 sources → divergence détectée (valeurs différentes)
  - Test sans divergence : même valeur de 2 sources → pas de document créé dans `discrepancies`
  - Test source priority : 3 sources (eb_api, email_parser, manual_entry) → stratégie de priorité correct
  - Test avec épargne : traiter `savings_balances` séparément
  - Mock CloudEvent, Firestore `query().stream()`, `batch.set()`
- **Dependencies :** Step 1.1, 1.2

**Step 2.3** — Tester `reconciliation_actions.py`

- **File :** Créer `tests/test_reconciliation_actions.py`
- **Action :**
  - Test action CHOOSE_SOURCE : sélectionner source, mise à jour `account_balances.source` et suppression discrepancy
  - Test action ACKNOWLEDGE : incrémenter `discrepancies[].acknowledgements[]`
  - Test action SET_MANUAL_VALUE : override valeur manuelle, créer entrée dans `manual_overrides`
  - Mock Firestore transaction, authentication context
- **Dependencies :** Step 1.1, 1.2

**Step 2.4** — Tester `firebase_db.py` (retry logic)

- **File :** Créer `tests/test_firebase_db.py`
- **Action :**
  - Test `_run_with_backoff()` : succès au premier appel, succès après 1-3 retries, dépassement max retries
  - Test backoff exponentiel : délais 1s, 2s, 4s, 8s
  - Tester exceptions : `ResourceExhausted`, `ServiceUnavailable`, `DeadlineExceeded` (retry), autres exceptions (no retry)
  - Test `_stream_with_backoff()` : itération stream avec retry sur erreur
  - Mock `firestore.Client.collection()`, simuler délais/erreurs
- **Dependencies :** Step 1.1, 1.2

### Phase 3 : Tests Unitaires JavaScript/TypeScript

**Step 3.1** — Tester fingerprinting (`balanceMapping.ts`)

- **File :** Créer `tests/utils/balanceMapping.test.ts`
- **Action :**
  - Test nominal : inputs valides (status, écart, previousSolde, etc.) → fingerprint stable
  - Test collision : deux inputs identiques → même fingerprint
  - Test champs manquants : undefined/null pour certains champs → fingerprint valide (ignore ou utilise fallback)
  - Test variation mineure : écart 0.01 vs 0.02 → fingerprints différents
  - Utiliser `describe/it`, `expect()` pattern (Vitest)
- **Dependencies :** Aucune (fichier existe déjà)

**Step 3.2** — Tester `ReconciliationReport.tsx`

- **File :** Créer `tests/components/ReconciliationReport.test.tsx`
- **Action :**
  - Test rendu avec divergences : affiche count "unresolved discrepancies", breakdown par source pair
  - Test sans divergences : affiche "No pending discrepancies"
  - Test avec épargne : filtre correct entre accounts/savings_balances
  - Mock `useBalances()` hook via `vi.mock()`
  - Utiliser `@testing-library/react` : `render()`, `screen.getByText()`, assertions
- **Dependencies :** Aucune

**Step 3.3** — Tester `useBalances.tsx` hook

- **File :** Créer `tests/hooks/useBalances.test.tsx`
- **Action :**
  - Test initial loading → `loading=true`
  - Test données chargées → `balances` contient arrays correctes
  - Test erreur Firestore → `error` défini
  - Mock Firebase `onSnapshot()`, `query()` via `vi.mock('@firebase/firestore')`
  - Utiliser `renderHook()` de @testing-library/react
- **Dependencies :** Aucune

### Phase 4 : Tests d'Intégration Légers (Optionnel mais Recommandé)

**Step 4.1** — Setup Firebase Emulator

- **File :** Créer `tests/integration/emulator.setup.ts`
- **Action :**
  - Initialiser Firebase Emulator Suite en CI (Firestore emulator port 8080)
  - Créer collections de test (`proposed_account_balances`, `account_balances`, `discrepancies`)
  - Configuration dans CI workflow
- **Dependencies :** Step 1.1, 1.2, 3.1

**Step 4.2** — Test cycle complet

- **File :** Créer `tests/integration/reconciliation-flow.integration.test.ts`
- **Action :**
  - Étape 1 : Injecter proposées balances via API (`ingest_balance`)
  - Étape 2 : Trigger reconciliation via Firestore write
  - Étape 3 : Vérifier discrepancies créées dans Firestore
  - Étape 4 : Exécuter réconciliation user action via API
  - Étape 5 : Vérifier `account_balances` mise à jour, discrepancies résolues
  - Mock appels HTTP, vrai Firestore Emulator pour transactions
- **Dependencies :** Step 4.1, 2.1-2.3

### Phase 5 : Intégration CI/GitHub Actions

**Step 5.1** — Créer workflow test Python

- **File :** Créer `.github/workflows/test-python.yml`
- **Action :**
  - Trigger : push sur branches `main`, `claude/*`, PR
  - Setup : Python 3.13, install `requirements.txt` + `functions/requirements.txt`
  - Run : `pytest tests/test_*.py -v --cov=functions --cov-report=xml`
  - Upload coverage report
- **Dependencies :** Phase 2 (Step 2.1-2.4)

**Step 5.2** — Créer workflow test JavaScript

- **File :** Modifier/créer `.github/workflows/test-js.yml`
- **Action :**
  - Trigger : push sur branches `main`, `claude/*`, PR
  - Setup : Node 20, `npm install`
  - Run : `npm run test` (Vitest) filtrer sur reconciliation files
  - Upload coverage report
- **Dependencies :** Phase 3 (Step 3.1-3.3)

**Step 5.3** — Intégration workflow test d'intégration

- **File :** Créer `.github/workflows/test-integration.yml`
- **Action :**
  - Trigger : même que test-python/test-js
  - Setup : Node 20, Python 3.13, Firebase Emulator
  - Run : `npm run test:integration` avec `FIREBASE_EMULATOR_HOST=localhost:8080`
  - Bloquer merge si échoue
- **Dependencies :** Phase 4 (Step 4.1-4.2)

**Step 5.4** — Branch protection rules

- **File :** `.github/settings.json` ou configuration GitHub Web
- **Action :**
  - Ajouter status checks requis : `test-python`, `test-js`, `test-integration`
  - Require branches to be up to date before merging
- **Dependencies :** Step 5.1-5.3

---

## Files to Create or Modify

| File                                                        | Action     | Purpose                                                 |
| ----------------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `tests/conftest.py`                                         | **Create** | Pytest fixtures : mock Firestore, requests, CloudEvents |
| `tests/test_balance_ingestion.py`                           | **Create** | Tests unitaires pour `balance_ingestion.py`             |
| `tests/test_balance_reconciliation.py`                      | **Create** | Tests unitaires pour `balance_reconciliation.py`        |
| `tests/test_reconciliation_actions.py`                      | **Create** | Tests unitaires pour `reconciliation_actions.py`        |
| `tests/test_firebase_db.py`                                 | **Create** | Tests unitaires pour retry logic Firebase               |
| `tests/utils/balanceMapping.test.ts`                        | **Create** | Tests fingerprinting function                           |
| `tests/components/ReconciliationReport.test.tsx`            | **Create** | Tests component reconciliation                          |
| `tests/hooks/useBalances.test.tsx`                          | **Create** | Tests hook data fetching                                |
| `tests/integration/emulator.setup.ts`                       | **Create** | Firebase Emulator configuration                         |
| `tests/integration/reconciliation-flow.integration.test.ts` | **Create** | E2E integration test                                    |
| `.github/workflows/test-python.yml`                         | **Create** | CI job Python tests                                     |
| `.github/workflows/test-js.yml`                             | **Create** | CI job JavaScript tests                                 |
| `.github/workflows/test-integration.yml`                    | **Create** | CI job integration tests                                |
| `functions/requirements.txt`                                | **Modify** | Ajouter pytest, pytest-mock                             |
| `package.json`                                              | **Modify** | Ajouter script `test:integration`                       |

---

## Risks and Mitigations

| Risk                                       | Likelihood | Impact | Mitigation                                                                                                             |
| ------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Dépendances manquantes en CI**           | Medium     | High   | Installer pytest, pytest-mock dans `functions/requirements.txt`. Tester localement d'abord.                            |
| **Mocking Firestore complexe**             | Medium     | Medium | Utiliser `unittest.mock.patch` avec side_effect pour simuler retries. Voir patterns dans tests existants.              |
| **Firebase Emulator non disponible en CI** | Low        | High   | Pre-install dans Docker image de CI ou faire multi-step setup dans workflow. Fallback : tests unitaires sans emulator. |
| **Tests Python/JS découplés**              | Low        | Low    | Cycle de test séparé acceptable — logiques métier différentes (Python backend, JS UI).                                 |
| **Temps d'exécution CI trop long**         | Medium     | Medium | Limiter scope : cibler seulement fichiers reconciliation. Paralléliser Python/JS jobs.                                 |
| **Coverage goals trop ambitieux**          | Low        | Low    | Target 80% coverage sur reconciliation core. Autres modules non couverts acceptables.                                  |

---

## Open Questions

1. **Coverage target :** Viser 80-90% pour reconciliation core? Ou 100%? (=> impact temps de dev)
2. **Firebase Emulator en CI :** Exécuter intégration tests en CI, ou seulement en local? (=> complexity)
3. **Secrets/tokens en tests :** Comment mock Google OIDC tokens? Utiliser fixtures avec clés test hardcodées?
4. **Documentation tests :** Ajouter README dans `tests/` expliquant structure et comment run? (=> maintenance)
5. **Autre framework Python :** Utiliser pytest ou pytest fixtures? (Recommandé : pytest car plus moderne, déjà pattern Python)

---

## Next Steps

1. **Revue plan** : Confirmer avec user (oui/non/modifications)
2. **Branche** : Créer/utiliser `claude/add-reconciliation-tests-UFzAJ`
3. **Exécution** : Suivre phases 1-5 dans l'ordre
4. **Validation** : Tous tests passent localement avant push
5. **PR + merge** : Ouvrir PR, vérifier CI passent, merger

---

**Author :** Claude Code  
**Status :** Draft (awaiting approval)
