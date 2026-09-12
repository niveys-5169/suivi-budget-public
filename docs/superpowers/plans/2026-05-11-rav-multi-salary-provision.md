# RAV Multi-Salary Provisioning Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement this plan.

**Goal:** Refactor the RAV calculation to handle multiple, distinct salary provisions, ensuring that each salary is tracked and "consumed" individually.

**Architecture:** This involves changing the data structure for RAV configuration (`RavConfigShape`) to replace the single `revenu_mensuel_net` with a more flexible `provision_salaires` object. The UI and calculation logic within `RAVEditor.tsx` will be updated accordingly.

**Tech Stack:** React, TypeScript, Firebase

---

### Task 1: Update Data Structure and UI in `RAVEditor.tsx`

**Files:**

- Modify: `public/src/components/budgets-v2/RAVEditor.tsx`

- [ ] **Step 1: Update the `RavConfigShape` interface**

```typescript
// In public/src/components/budgets-v2/RAVEditor.tsx

// SEARCH
interface RavConfigShape {
  revenu_mensuel_net: number | null;
  revenu_categories: string[];
  depense_categories: string[];
  included_accounts: string[];
}

// REPLACE with
interface SalaryProvision {
  montant: number;
  categorie: string;
}

interface RavConfigShape {
  revenu_mensuel_net: number | null; // Deprecated, kept for migration
  provision_salaires?: {
    [key: string]: SalaryProvision;
  };
  revenu_categories: string[];
  depense_categories: string[];
  included_accounts: string[];
}
```

- [ ] **Step 2: Update the state and UI for salary provisions**

Replace the single input with two, and manage the new state structure.

```typescript
// In public/src/components/budgets-v2/RAVEditor.tsx

// SEARCH (The whole block for the old input)
<label className="text-[10px] font-black text-platinum/40 uppercase tracking-[0.3em] flex items-center gap-2 mb-2">
    <Wallet size={11} className="text-gold" /> Provision pour salaire (€)
</label>
<input
    type="number"
    step="0.01"
    min="0"
    inputMode="decimal"
    placeholder="Provision pour le salaire principal"
    className="h-11 w-full rounded-xl border border-glass-border bg-ink-100 text-sm px-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-gold/40 transition-all font-serif font-bold"
    value={draft.revenu_mensuel_net ?? ''}
    onChange={(e) => {
    const v = e.target.value;
    setDraft({ ...draft, revenu_mensuel_net: v === '' ? null : parseFloat(v) });
    }}
/>

// REPLACE with
<div className="space-y-4">
    <label className="text-[10px] font-black text-platinum/40 uppercase tracking-[0.3em] flex items-center gap-2">
        <Wallet size={11} className="text-gold" /> Provisions pour salaires (€)
    </label>
    <input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        placeholder="Provision Salaire Nico"
        className="h-11 w-full rounded-xl border border-glass-border bg-ink-100 text-sm px-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-gold/40 transition-all font-serif font-bold"
        value={draft.provision_salaires?.nico?.montant ?? ''}
        onChange={(e) => {
            const v = e.target.value;
            setDraft(prev => ({
                ...prev,
                provision_salaires: {
                    ...prev.provision_salaires,
                    nico: { montant: v === '' ? 0 : parseFloat(v), categorie: 'Salaire Nico' }
                }
            }));
        }}
    />
    <input
        type="number"
        step="0.01"
        min="0"
        inputMode="decimal"
        placeholder="Provision Salaire Gwen"
        className="h-11 w-full rounded-xl border border-glass-border bg-ink-100 text-sm px-4 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-gold/40 transition-all font-serif font-bold"
        value={draft.provision_salaires?.gwen?.montant ?? ''}
        onChange={(e) => {
            const v = e.target.value;
            setDraft(prev => ({
                ...prev,
                provision_salaires: {
                    ...prev.provision_salaires,
                    gwen: { montant: v === '' ? 0 : parseFloat(v), categorie: 'Salaire Gwen' }
                }
            }));
        }}
    />
</div>
```

- [ ] **Step 3: Update `useEffect` to handle data migration**

Handle the old `revenu_mensuel_net` field.

```typescript
// In public/src/components/budgets-v2/RAVEditor.tsx

// SEARCH
useEffect(() => {
  if (globalRavConfig) {
    const next: RavConfigShape = {
      revenu_mensuel_net: globalRavConfig.revenu_mensuel_net ?? null,
      revenu_categories: globalRavConfig.revenu_categories ?? [],
      depense_categories: globalRavConfig.depense_categories ?? [],
      included_accounts: globalRavConfig.included_accounts ?? [],
    };
    setConfig(next);
    if (!editing) setDraft(next);
  }
}, [globalRavConfig, editing]);

// REPLACE with
useEffect(() => {
  if (globalRavConfig) {
    const next: RavConfigShape = {
      ...globalRavConfig,
      provision_salaires: globalRavConfig.provision_salaires ?? {},
    };
    // Simple migration from old field
    if (
      globalRavConfig.revenu_mensuel_net &&
      (!globalRavConfig.provision_salaires ||
        Object.keys(globalRavConfig.provision_salaires).length === 0)
    ) {
      next.provision_salaires = {
        nico: { montant: globalRavConfig.revenu_mensuel_net, categorie: 'Salaire Nico' },
      };
    }
    setConfig(next);
    if (!editing) setDraft(next);
  }
}, [globalRavConfig, editing]);
```

---

### Task 2: Update Calculation Logic in `RAVEditor.tsx`

- [ ] **Step 1: Update `computedFromConfig` to use the new salary provisions**

```typescript
// In public/src/components/budgets-v2/RAVEditor.tsx

// SEARCH (the whole function body)
const computedFromConfig = (cfg: RavConfigShape): DerivedRav => {
  // ... entire old function body ...
};

// REPLACE with
const computedFromConfig = (cfg: RavConfigShape): DerivedRav => {
  const incomeMatches = categoryMatcher(cfg.revenu_categories, DEFAULT_EXCLUDED_INCOMES);
  const expenseMatches = categoryMatcher(cfg.depense_categories, DEFAULT_EXCLUDED_EXPENSES);

  let totalIncome = 0;
  let totalExpenses = 0;

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

  let salaryProvisions = 0;
  if (cfg.provision_salaires) {
    for (const key in cfg.provision_salaires) {
      const provision = cfg.provision_salaires[key];
      const hasReceived = txList.some((t: any) => {
        const isRightMonth = (t.moisAffectation || t.date || '').slice(0, 7) === monthKey;
        if (!isRightMonth || t.categorie !== provision.categorie) {
          return false;
        }
        const txAmount = Math.abs(Number(t.montant) || 0);
        const expectedAmount = Math.abs(provision.montant || 0);
        return txAmount >= expectedAmount * 0.5 && txAmount <= expectedAmount * 1.5;
      });

      if (!hasReceived && provision.montant > 0) {
        salaryProvisions += provision.montant;
      }
    }
  }

  const recurringIncomeProvisions = getRecurringProvisions(
    monthKey,
    txList,
    recurringSettings,
    'income',
  );
  const expenseProvisions = getRecurringProvisions(monthKey, txList, recurringSettings, 'expense');

  const totalProjectedIncome = totalIncome + recurringIncomeProvisions + salaryProvisions;
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

- [ ] **Step 2: Update `handleSave` to save the new data structure**

```typescript
// In public/src/components/budgets-v2/RAVEditor.tsx

// SEARCH
const handleSave = async () => {
  setSaving(true);
  setError(null);
  try {
    await setDoc(
      doc(db, 'metadata', 'rav_config'),
      {
        revenu_mensuel_net: draft.revenu_mensuel_net,
        revenu_categories: draft.revenu_categories,
        depense_categories: draft.depense_categories,
        included_accounts: draft.included_accounts,
      },
      { merge: true },
    );
    setEditing(false);
  } catch (err: any) {
    setError(err?.message || 'Sauvegarde impossible');
  } finally {
    setSaving(false);
  }
};

// REPLACE with
const handleSave = async () => {
  setSaving(true);
  setError(null);
  try {
    const newConfig = {
      ...draft,
      revenu_mensuel_net: null, // Set old field to null
    };
    await setDoc(doc(db, 'metadata', 'rav_config'), newConfig, { merge: true });
    setEditing(false);
  } catch (err: any) {
    setError(err?.message || 'Sauvegarde impossible');
  } finally {
    setSaving(false);
  }
};
```

---

### Task 3: Final Commit

- [ ] **Step 1: Commit the changes**

```bash
git add public/src/components/budgets-v2/RAVEditor.tsx
git commit -m "feat(rav): implement multi-salary provisioning"
```
