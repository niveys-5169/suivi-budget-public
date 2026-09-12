# 💰 Budget Management API Reference

**Version:** 1.0  
**Last Updated:** 2026-04-28  
**Scope:** `BudgetContext` + UI Components (`BudgetManagerPanel`, `RAVEditor`)

---

## 📋 Table des Matières

1. [BudgetContext API](#budgetcontext-api)
2. [Components Props](#components-props)
3. [Firestore Schemas](#firestore-schemas)
4. [Usage Examples](#usage-examples)

---

## BudgetContext API

### `useBudgetContext()`

Hook pour accéder au contexte des budgets.

```typescript
const {
  // État
  viewMode,              // 'monthly' | 'annual' — mode d'affichage courant
  monthKey,              // 'YYYY-MM' — mois courant sélectionné
  budgets,               // Budget[] — budgets actifs, montants scalés au mode
  monthly,               // BudgetOverride[] — surcharges mensuelles
  annual,                // BudgetOverride[] — surcharges annuelles
  loading,               // boolean

  // Setters
  setViewMode(mode),     // (mode: 'monthly' | 'annual') => void
  setMonthKey(key),      // (key: 'YYYY-MM') => void

  // Methods
  refresh(),             // () => void — rechargement forcé depuis Firestore
  getBudgetCategoryCandidates(), // () => string[] — catégories candidates

  // CRUD + RAV
  updateBaseBudget(categorie, montant, type?),  // async
  updateMonthlyBudget(categorie, montant),       // async — override ce mois
  updateAnnualDefault(categorie, montant),       // async — override cette année
  removeBudgetCategory(categorie),               // async — suppression
} = useBudgetContext();
```

### Methods Detail

#### `updateBaseBudget(categorie, montant, type?)`

Met à jour le budget de base d'une catégorie.

**Signature:**

```typescript
updateBaseBudget(
  categorie: string,
  montant: number,
  type?: 'mensuel' | 'annuel'  // défaut: 'mensuel'
): Promise<void>
```

**Comportement:**

- Crée ou met à jour le doc Firestore `budgets/{docId}`
- `docId` = `budgetDocCategoryKey(categorie)` (encodeURIComponent si "/" dans categorie)
- Écrit: `{ categorie, nom, montant, type, actif: true, updatedAt }`
- Si `type = 'annuel'`, le `computedBudgets` affichera `montant` directement en mode annual, et `montant/12` en mode monthly
- Si `type = 'mensuel'` (défaut), affiche `montant` en monthly et `montant*12` en annual

**Exemple:**

```typescript
// Budget mensuel de 500€ pour "Courses"
await updateBaseBudget('Courses', 500, 'mensuel');

// Budget annuel de 2000€ pour "Vacances"
await updateBaseBudget('Vacances', 2000, 'annuel');
```

---

#### `updateMonthlyBudget(categorie, montant)`

Écrase le budget d'une catégorie **pour ce mois seulement**.

**Signature:**

```typescript
updateMonthlyBudget(categorie: string, montant: number): Promise<void>
```

**Firestore:**

```
collections/budgets_monthly
  - docId: "{monthKey}__{docId de categorie}"
  - data: { month, categorie, montant, updatedAt }
```

**Comportement:**

- Override pour le `monthKey` courant uniquement
- Persiste indépendamment du mode (monthly/annual)
- Affiche `montant` brut dans le `computedBudgets` final

---

#### `updateAnnualDefault(categorie, montant)`

Fixe le budget annuel d'une catégorie **pour cette année seulement**.

**Signature:**

```typescript
updateAnnualDefault(categorie: string, montant: number): Promise<void>
```

**Firestore:**

```
collections/budgets_annual_defaults
  - docId: "{year}__{docId de categorie}"
  - data: { year, categorie, annualMontant, updatedAt }
```

---

#### `removeBudgetCategory(categorie)`

Supprime une catégorie de budget.

**Signature:**

```typescript
removeBudgetCategory(categorie: string): Promise<void>
```

**Comportement:**

- Cherche tous les docs Firestore matchant la catégorie
- Hard delete avec fallback soft delete (`actif: false`) si erreur
- Filtrés par `b.actif !== false` en aval, donc invisibles immédiatement

**Exemple:**

```typescript
// Supprimer "Streaming" des budgets
await removeBudgetCategory('Streaming');
```

---

#### `getBudgetCategoryCandidates()`

Retourne une liste de catégories candidates pour ajout/auto-complete.

**Signature:**

```typescript
getBudgetCategoryCandidates(): string[]
```

**Sources:**

1. Catégories de budgets existants (window.CATEGORIES si fourni)
2. Transactions les plus récentes (via `state.ALL_TX`)
3. Dédupliquées et triées alphabétiquement (FR locale)

---

## Components Props

### `<BudgetManagerPanel />`

Panneau collapsible pour éditer les budgets (mensuel/annuel, add/remove categories).

```typescript
interface BudgetManagerPanelProps {
  onClose: () => void; // Callback quand l'utilisateur clique X
}
```

**Utilisation:**

```typescript
const [showManager, setShowManager] = useState(false);

return (
  <>
    <button onClick={() => setShowManager(!showManager)}>Gérer</button>
    <AnimatePresence>
      {showManager && <BudgetManagerPanel onClose={() => setShowManager(false)} />}
    </AnimatePresence>
  </>
);
```

**Comportement interne:**

- Lecture de `useBudgetContext()`
- Bascule viewMode → recompute les montants affichés
- Édition inline via `updateBaseBudget()`
- Ajout via même méthode
- Suppression via `removeBudgetCategory()`
- Dispatch `window.dispatchEvent(new CustomEvent('budget-data-updated'))` après chaque change (signal pour les autres composants)

---

### `<RAVEditor />`

Panneau d'édition du Reste à Vivre (configurable revenu + catégories).

```typescript
interface RAVEditorProps {
  monthKey: string; // 'YYYY-MM' — mois pour lequel calculer le RAV
  onClose?: () => void; // Optionnel: callback fermeture
}
```

**Utilisation:**

```typescript
const [showRav, setShowRav] = useState(false);
const { monthKey } = useBudgetContext();

return (
  <>
    <button onClick={() => setShowRav(!showRav)}>RAV</button>
    <AnimatePresence>
      {showRav && <RAVEditor monthKey={monthKey} onClose={() => setShowRav(false)} />}
    </AnimatePresence>
  </>
);
```

**Comportement interne:**

- Écoute `metadata/rav_config` via snapshot
- Calcule RAV live : `Revenus − Dépenses − Provisions`
- Mode édition optionnel → aperçu live avant sauvegarde
- Persiste sur `setDoc(doc(db, 'metadata/rav_config'), ...)`

---

## Firestore Schemas

### Collections Principales

#### `collections/budgets`

Budgets de base (non-overridés).

```typescript
{
  id: string;                    // docId = budgetDocCategoryKey(categorie)
  categorie: string;             // Ex: "Courses", "Salaire"
  nom: string;                   // Label affichage (généralement = categorie)
  montant: number;               // Montant brut
  type: 'mensuel' | 'annuel' | 'ponctuel';
  actif: boolean;                // Si false, caché de la UI
  updatedAt: Timestamp;
  // Optionnel:
  periode?: { type, debut?, fin? };  // Pour 'ponctuel'
  compte?: string | null;            // Filtre par compte spécifique
}
```

#### `collections/budgets_monthly`

Surcharges mensuelles (spécifiques à un mois).

```typescript
{
  id: string; // Format: "{monthKey}__{categoryDocId}"
  month: 'YYYY-MM'; // Clé du mois
  categorie: string; // Catégorie
  montant: number; // Montant override ce mois
  updatedAt: Timestamp;
}
```

#### `collections/budgets_annual_defaults`

Surcharges annuelles (spécifiques à une année).

```typescript
{
  id: string; // Format: "{year}__{categoryDocId}"
  year: '2026'; // Année
  categorie: string; // Catégorie
  annualMontant: number; // Montant annuel override
  updatedAt: Timestamp;
}
```

#### `collections/metadata/rav_config`

Configuration du Reste à Vivre (global).

```typescript
{
  revenu_mensuel_net: number | null;  // null = mode AUTO
  revenu_categories: string[];        // Catégories marquées comme revenus
  depense_categories: string[];       // Si vide = toutes sauf defaults
}
```

---

## Usage Examples

### Exemple 1 : Créer un budget mensuel simple

```typescript
function AddBudget() {
  const { updateBaseBudget } = useBudgetContext();

  const handleCreate = async () => {
    await updateBaseBudget('Courses', 500, 'mensuel');
    // Budget créé : 500€/mois pour "Courses"
  };

  return <button onClick={handleCreate}>Créer 500€ Courses</button>;
}
```

### Exemple 2 : Switch mensuel/annuel en gardant cohérence

```typescript
function BudgetList() {
  const { budgets, viewMode, setViewMode, monthKey } = useBudgetContext();

  // budgets[i].montant est déjà scalé au viewMode!
  // Si base = 500 mensuel:
  //   - monthly view: affiche 500
  //   - annual view: affiche 6000 (500*12)

  return (
    <div>
      <button onClick={() => setViewMode(viewMode === 'monthly' ? 'annual' : 'monthly')}>
        Toggle: {viewMode}
      </button>
      {budgets.map(b => (
        <div key={b.id}>{b.nom}: {fmt(b.montant)}</div>
      ))}
    </div>
  );
}
```

### Exemple 3 : Intégrer les panneaux éditables

```typescript
function BudgetPage() {
  const { monthKey } = useBudgetContext();
  const [showManager, setShowManager] = useState(false);
  const [showRav, setShowRav] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => setShowManager(!showManager)}>Gérer budgets</button>
        <button onClick={() => setShowRav(!showRav)}>Configurer RAV</button>
      </div>

      <AnimatePresence>
        {showRav && <RAVEditor monthKey={monthKey} onClose={() => setShowRav(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showManager && <BudgetManagerPanel onClose={() => setShowManager(false)} />}
      </AnimatePresence>

      <YourExistingBudgetGrid />
    </div>
  );
}
```

---

## 🔗 Voir aussi

- `docs/plans/2026-04-28-budget-editing-rav-management.md` — Plan d'implémentation
- `public/src/context/BudgetContext.tsx` — Source du context
- `public/src/components/budgets-v2/BudgetManagerPanel.tsx` — Code du composant
- `public/src/components/budgets-v2/RAVEditor.tsx` — Code du composant
- `DESIGN_SYSTEM.md` — Thème AURUM (Gold/Ink)

---

_Ce document reste la source de vérité pour l'API Budget jusqu'à refactoring majeur._
