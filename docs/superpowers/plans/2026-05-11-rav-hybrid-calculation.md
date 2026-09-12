# RAV Hybrid Calculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the "Reste à Vivre" (RAV) calculation to be more dynamic, using a hybrid approach that combines a fixed monthly income (`revenu_mensuel_net`) with real-time transactions and provisions.

**Architecture:** The changes will be contained within the `RAVEditor.tsx` component. We will generalize the existing provision calculation logic to handle both incomes and expenses, and introduce the `revenu_mensuel_net` as a special type of provision for the main salary.

**Tech Stack:** React, TypeScript, Firebase

---

### Task 1: Refactor `RAVEditor.tsx` to use Hybrid Calculation Model

**Files:**

- Modify: `public/src/components/budgets-v2/RAVEditor.tsx`

- [ ] **Step 1: Generalize the `getRecurringProvisions` function**

The function will be modified to handle both incomes and expenses.

```typescript
// In public/src/components/budgets-v2/RAVEditor.tsx

// SEARCH
function getRecurringProvisions(monthKey: string, txs: any[], recurringSettings: Record<string, any>): number {
  const monthTxs = txs.filter((t: any) =>
    (t.moisAffectation || t.date || '').slice(0, 7) === monthKey
    && !!t.pointe && (Number(t.montant) || 0) < 0
  );
  return Object.entries(recurringSettings)
    .filter(([, s]: [string, any]) => s?.status === 'accepted' && (Number(s?.manualAmount) || 0) < 0 && (s?.customFreq || 'Mensuel') === 'Mensuel')
    .filter(([key, s]: [string, any]) => {
// ... (rest of the function)

// REPLACE with
function getRecurringProvisions(monthKey: string, txs: any[], recurringSettings: Record<string, any>, movementType: 'expense' | 'income'): number {
  const isExpense = movementType === 'expense';
  const monthTxs = txs.filter((t: any) =>
    (t.moisAffectation || t.date || '').slice(0, 7) === monthKey
    && !!t.pointe && (isExpense ? (Number(t.montant) || 0) < 0 : (Number(t.montant) || 0) > 0)
  );
  return Object.entries(recurringSettings)
    .filter(([, s]: [string, any]) =>
        s?.status === 'accepted' &&
        (isExpense ? (Number(s?.manualAmount) || 0) < 0 : (Number(s?.manualAmount) || 0) > 0) &&
        (s?.customFreq || 'Mensuel') === 'Mensuel'
    )
    .filter(([key, s]: [string, any]) => {
// ... (rest of the function)
```

- [ ] **Step 2: Update `computedFromConfig` with the new hybrid logic**

This is the core of the change, where the new RAV calculation is implemented.

```typescript
// In public/src/components/budgets-v2/RAVEditor.tsx

// SEARCH
const computedFromConfig = (cfg: RavConfigShape): DerivedRav => {
  // ... (up to provisions calculation)
  const provisions = getRecurringProvisions(monthKey, txList, recurringSettings);

  // Le reste est calculé sur le Revenu de Référence moins les dépenses réelles et les provisions.
  const reste = revenuRef + totalExpenses + provisions;
  const pct = revenuRef > 0 ? Math.max(0, Math.min(100, (reste / revenuRef) * 100)) : 0;

  return {
    reste,
    revenuRef,
    totalDep: totalExpenses,
    provisions,
    modeLabel: cfg.revenu_mensuel_net ? 'FIXE' : 'BUDGET',
    pct,
  };
};

// REPLACE with
const computedFromConfig = (cfg: RavConfigShape): DerivedRav => {
  const incomeMatches = categoryMatcher(cfg.revenu_categories, DEFAULT_EXCLUDED_INCOMES);
  const expenseMatches = categoryMatcher(cfg.depense_categories, DEFAULT_EXCLUDED_EXPENSES);

  let totalIncome = 0;
  let totalExpenses = 0;

  const SALARY_CATEGORIES = ['Salaire Gwen', 'Salaire Nico'];

  txList.forEach((t: any) => {
    const isRightMonth = (t.moisAffectation || t.date || '').slice(0, 7) === monthKey;
    const isAccountIncluded =
      cfg.included_accounts.length > 0 ? cfg.included_accounts.includes(t.accountId) : true;

    if (isRightMonth && !!t.pointe && isAccountIncluded) {
      const amount = Number(t.montant) || 0;
      const cat = (t.categorie || '').trim();
      if (amount >= 0 && incomeMatches(cat)) {
        totalIncome += amount;
      } else if (amount < 0 && expenseMatches(cat)) {
        totalExpenses += amount;
      }
    }
  });

  const hasReceivedSalary = txList.some(
    (t: any) =>
      (t.moisAffectation || t.date || '').slice(0, 7) === monthKey &&
      SALARY_CATEGORIES.includes(t.categorie),
  );

  let incomeProvisions = getRecurringProvisions(monthKey, txList, recurringSettings, 'income');
  if (cfg.revenu_mensuel_net && cfg.revenu_mensuel_net > 0 && !hasReceivedSalary) {
    incomeProvisions += cfg.revenu_mensuel_net;
  }

  const expenseProvisions = getRecurringProvisions(monthKey, txList, recurringSettings, 'expense');

  const totalProjectedIncome = totalIncome + incomeProvisions;
  const totalProjectedExpenses = totalExpenses + expenseProvisions;

  const reste = totalProjectedIncome + totalProjectedExpenses;
  const pct =
    totalProjectedIncome > 0 ? Math.max(0, Math.min(100, (reste / totalProjectedIncome) * 100)) : 0;

  return {
    reste,
    revenuRef: totalProjectedIncome,
    totalDep: totalExpenses,
    provisions: expenseProvisions,
    modeLabel: 'DYNAMIQUE',
    pct,
  };
};
```

- [ ] **Step 3: Adjust the UI to reflect the new dynamic mode**

The input for `revenu_mensuel_net` is still relevant, but the labels should reflect the new reality.

```typescript
// In public/src/components/budgets-v2/RAVEditor.tsx render method

// SEARCH
<span className="text-platinum/30 font-light text-sm ml-3 normal-case italic">Mode {liveCurrent.modeLabel}</span>

// REPLACE with
<span className="text-platinum/30 font-light text-sm ml-3 normal-case italic">Mode {liveCurrent.modeLabel}</span>

// SEARCH for the revenu_mensuel_net input and its label
<label className="text-[10px] font-black text-platinum/40 uppercase tracking-[0.3em] flex items-center gap-2 mb-2">
    <Wallet size={11} className="text-gold" /> Revenu net mensuel fixe (€)
    <button
    onClick={() => setDraft({ ...draft, revenu_mensuel_net: null })}
    className="ml-auto text-[10px] font-black text-platinum/30 hover:text-gold uppercase tracking-widest flex items-center gap-1"
    title="Repasser en mode BUDGET (somme des revenus budgétés)"
    >
    <RotateCcw size={10} /> Budget
    </button>
</label>
<input
    type="number"
    // ...
    placeholder="Laisser vide pour utiliser la somme des revenus budgétés"
    // ...
/>

// REPLACE with
<label className="text-[10px] font-black text-platinum/40 uppercase tracking-[0.3em] flex items-center gap-2 mb-2">
    <Wallet size={11} className="text-gold" /> Provision pour salaire (€)
</label>
<input
    type="number"
    // ...
    placeholder="Provision pour le salaire principal"
    // ...
/>

// SEARCH
<div className="text-[10px] font-black text-platinum/30 uppercase tracking-widest mt-1">
    {liveCurrent.modeLabel === 'FIXE' ? 'Saisi manuellement' : 'Somme des revenus budgétés'}
</div>

// REPLACE with
<div className="text-[10px] font-black text-platinum/30 uppercase tracking-widest mt-1">
    Calcul dynamique
</div>

```

- [ ] **Step 4: Commit the changes**

```bash
git add public/src/components/budgets-v2/RAVEditor.tsx
git commit -m "feat(rav): implement hybrid calculation model"
```
