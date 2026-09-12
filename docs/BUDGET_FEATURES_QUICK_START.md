# 🚀 Budget Management Features — Quick Start Guide

**Pour les développeurs qui veulent continuer le travail sur les budgets et RAV.**

---

## 📍 Où Commencer

### 1. Lire les docs en cet ordre

1. ✅ `docs/ARCH_STATE.md` — comprendre l'archi générale
2. ✅ `docs/plans/2026-04-28-budget-editing-rav-management.md` — comprendre ce qui a été fait
3. ✅ `docs/BUDGET_MANAGEMENT_API.md` — référence API complète
4. ✅ Code source (`public/src/components/budgets-v2/{BudgetManagerPanel,RAVEditor}.tsx`)

### 2. Cloner / checkout la branche

```bash
git checkout -b local-feature origin/claude/budget-management-system-Q1UjP
npm install
npm run dev
```

### 3. Tester les nouvelles fonctionnalités

- Aller à `/budgets` (page Budgets)
- Cliquer sur `Reste à vivre` → Configure revenu, ajouté/retire catégories, vois l'aperçu live
- Cliquer sur `Gérer les budgets` → Édite montants inline, bascule mensuel/annuel, ajoute/supprime catégories

---

## 🏗 Fichiers Clés

```
public/src/
├── components/budgets-v2/
│   ├── BudgetManagerPanel.tsx         ← Édition budgets mensuels/annuels
│   ├── RAVEditor.tsx                  ← Édition RAV (revenus/dépenses)
│   ├── bankin/
│   │   └── BankinBudgetsContainer.tsx ← Point d'accès (UI active)
│   └── BudgetsPage.tsx                ← Fallback legacy
├── context/
│   └── BudgetContext.tsx              ← Logique globale (updateBaseBudget, removeBudgetCategory)
├── hooks/
│   ├── useBudgetContext.ts            ← Accès au context
│   └── useDashboard.tsx               ← RavConfig interface
└── api/
    └── budgets.js                     ← CRUD brut (createBudget, updateBudget, deleteBudget)
```

---

## 💡 Concepts Clés

### BudgetContext

```typescript
const {
  viewMode,                           // 'monthly' | 'annual'
  monthKey,                           // 'YYYY-MM'
  budgets,                            // Budget[] — montants scalés
  updateBaseBudget(cat, val, type?),  // ← Éditer budgets
  removeBudgetCategory(cat),          // ← Supprimer
  getBudgetCategoryCandidates(),      // ← Candidates pour add
} = useBudgetContext();
```

### Firestore Structure

- `budgets/{docId}` → Budget de base (type: mensuel|annuel|ponctuel)
- `budgets_monthly/{month__{catId}}` → Override ce mois
- `budgets_annual_defaults/{year__{catId}}` → Override cette année
- `metadata/rav_config` → RAV: revenu_mensuel_net, revenu_categories[], depense_categories[]

### Scaling Logic

Le `computedBudgets` dans BudgetContext **scale automatiquement** selon le mode:

- **Base monthly 500€ (type=mensuel)**
  - Monthly view: 500€
  - Annual view: 6000€ (500×12)
- **Base annual 2000€ (type=annuel)**
  - Monthly view: ~167€ (2000÷12)
  - Annual view: 2000€

---

## 🔧 Tâches Courantes

### Ajouter une nouvelle catégorie budgétée

```typescript
const { updateBaseBudget } = useBudgetContext();

// Mensuel
await updateBaseBudget('Streaming', 12.99, 'mensuel');

// Annuel
await updateBaseBudget('Vacances', 3000, 'annuel');
```

### Éditer un budget pour ce mois seulement

```typescript
const { updateMonthlyBudget } = useBudgetContext();
// Avril seulement: 600€ au lieu de 500€
await updateMonthlyBudget('Courses', 600);
```

### Éditer le RAV (revenu + catégories)

```typescript
// Fait directement via RAVEditor UI, persiste sur metadata/rav_config
// Ou via code:
const db = initializeApp(...).firestore;
await setDoc(doc(db, 'metadata', 'rav_config'), {
  revenu_mensuel_net: 3500,          // FIXE: montant exact
  revenu_categories: ['Salaire'],    // Catégories marquées "revenus"
  depense_categories: ['Courses', 'Transport'],  // Catégories "dépenses" (vide = toutes sauf defaults)
}, { merge: true });
```

### Ajouter une colonne ou une métrique au panneau de gestion

1. Éditer `BudgetManagerPanel.tsx` → section "Stats" (grid avec totals)
2. Calcul dans le `useMemo(() => {}, [sortedBudgets])`
3. Rerender et test

### Personnaliser les couleurs / classes Tailwind

- Se référer à `DESIGN_SYSTEM.md` et `tailwind.config.js`
- Palette: `text-gold`, `text-platinum`, `bg-ink`, `bg-ruby`, `bg-emerald-500`
- Shadows: `shadow-gold/20`, etc.

---

## 🧪 Testing

### Build & Type Check

```bash
npm run build
npx tsc --noEmit
```

### Existing Tests

```bash
npx vitest run public/src/components/budgets-v2/bankin/__tests__/BankinBudgetsContainer.test.tsx
```

### Unit Tests (À ajouter)

Pas encore de tests spécifiques pour BudgetManagerPanel / RAVEditor. Candidates:

- Tests des setups initial (lectuer metadata/rav_config)
- Tests des validations (montant négatif, catégorie dupliquée)
- Tests de l'aperçu live RAV
- Tests des sauvegardes Firestore (mock)

---

## 🚀 Prochaines Améliorations Recommandées

### 1. **Monthly-Specific Overrides UI** (Facile, ~2h)

Ajouter la capacité d'éditer le budget d'une catégorie **pour ce mois uniquement** (sans changer le base).

- Ajouter un toggle "Ce mois seulement" dans BudgetManagerPanel
- Appeler `updateMonthlyBudget()` au lieu de `updateBaseBudget()`

### 2. **Bulk Category Add** (Moyen, ~3h)

Importer une liste de catégories CSV et les créer en batch.

- Parser CSV → valider → batch créations
- UI: textarea avec suggestions

### 3. **Category Type Constraints** (Moyen, ~2h)

Empêcher l'édition croisée des types (ponctuel ≠ mensuel).

- Filter `getBudgetCategoryCandidates()` par type courant
- UI: afficher le type courant dans BudgetManagerPanel

### 4. **RAV Projections** (Avancé, ~5h)

Afficher les projections futures du RAV.

- Courbe: RAV projeté mois par mois
- Basé sur les patterns historiques + budgets

### 5. **Audit Trail / History** (Avancé, ~4h)

Log des modifications (qui, quand, quelle valeur).

- Collection: `metadata/budget_edits_log`
- UI: view-only history panel

### 6. **Category Archiving** (Facile, ~1h)

Soft-delete visible à l'utilisateur avec option "restore".

- Colonne `archived: boolean` au lieu de hard delete
- Filter `b.archived !== true`

---

## 📝 Common Gotchas

### ⚠️ Firestore Document IDs

Les IDs de catégories contenant "/" doivent être encodées:

```typescript
// ❌ WRONG: `/Banking/Salary` comme ID
// ✅ RIGHT: `__enc__${encodeURIComponent('/Banking/Salary')}`
const docId = budgetDocCategoryKey('Salaire/Net');
// → "__enc__Salaire%2FNet"
```

### ⚠️ viewMode vs monthKey

- `viewMode` change la **représentation** des montants (monthly ↔ annual)
- `monthKey` change le **mois courant** pour filtrer transactions
- Les deux sont indépendants: on peut voir monthly view d'avril, ou annual view de 2026

### ⚠️ computedBudgets vs budgets

- `budgets` du context = raw from Firestore
- `computedBudgets` = montants scalés selon `viewMode`
- Toujours afficher `computedBudgets` à l'utilisateur

### ⚠️ RAV Configuration dans metadata/rav_config

Les catégories doivent correspondre à celles réelles dans les transactions.

- Si `revenu_categories: ['Salaire Gwen']` mais transactions ont `'Salaire Gwend'` → pas de match
- Utiliser les suggestions du RAVEditor pour éviter les typos

---

## 🔗 Plus de Ressources

- **Branch de développement:** `claude/budget-management-system-Q1UjP` (commit b57a4b0)
- **Slack/Discord (si applicable):** #budgets-dev
- **Issues GitHub:** Tag `budget-management`
- **Lead Dev:** (Insérer le contact ici si applicable)

---

_Bonne chance! Fais des PR régulières et demande de la review. 🚀_
