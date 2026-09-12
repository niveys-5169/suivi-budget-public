# Mobile Analyse Screen Implementation Plan (Lot 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a mobile-first Analysis screen with monthly navigation, Entrées/Sorties/Récurrences filtering, a donut chart, and category-wise breakdown.

**Architecture:** Create a central `AnalyseScreen` container in `public/src/mobile/screens/` and specialized components in `public/src/mobile/components/`. Reuse `useTransactions` and `useAppState` for data and state management.

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons, Recharts, React-Intl.

---

### Task 1: Create Shared Mobile Components (MonthNavigator, SegmentedControl)

**Files:**

- Create: `public/src/mobile/components/MMonthNavigator.tsx`
- Create: `public/src/mobile/components/MSegmentedControl.tsx`

- [ ] **Step 1: Implement `MMonthNavigator`**

```tsx
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MMonthNavigatorProps {
  monthKey: string; // YYYY-MM
  onChange: (newKey: string) => void;
}

export const MMonthNavigator: React.FC<MMonthNavigatorProps> = ({ monthKey, onChange }) => {
  const date = parseISO(`${monthKey}-01`);

  const handlePrev = () => {
    const prev = subMonths(date, 1);
    onChange(format(prev, 'yyyy-MM'));
  };

  const handleNext = () => {
    const next = addMonths(date, 1);
    onChange(format(next, 'yyyy-MM'));
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 shrink-0">
      <button
        onClick={handlePrev}
        className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full text-gold active:scale-90 transition-transform"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="text-m-title font-bold text-white capitalize">
        {format(date, 'MMMM yyyy', { locale: fr })}
      </span>
      <button
        onClick={handleNext}
        className="w-10 h-10 flex items-center justify-center bg-white/5 rounded-full text-gold active:scale-90 transition-transform"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Implement `MSegmentedControl`**

```tsx
import React from 'react';

export type AnalyseMode = 'sorties' | 'entrees' | 'recurrences';

interface MSegmentedControlProps {
  value: AnalyseMode;
  onChange: (val: AnalyseMode) => void;
}

export const MSegmentedControl: React.FC<MSegmentedControlProps> = ({ value, onChange }) => {
  const modes: { id: AnalyseMode; label: string }[] = [
    { id: 'sorties', label: 'Sorties' },
    { id: 'entrees', label: 'Entrées' },
    { id: 'recurrences', label: 'Récurrences' },
  ];

  return (
    <div className="px-4 py-2">
      <div className="flex p-1 bg-ink-100/50 border border-glass-border rounded-xl">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className={`flex-1 py-2 text-m-label font-bold transition-all rounded-lg
              ${
                value === mode.id
                  ? 'bg-gold/10 text-gold shadow-sm'
                  : 'text-zinc-500 active:text-zinc-300'
              }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify build**
      Run: `npm run typecheck`
      Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/src/mobile/components/MMonthNavigator.tsx public/src/mobile/components/MSegmentedControl.tsx
git commit -m "feat(mobile): add MonthNavigator and SegmentedControl components"
```

---

### Task 2: Implement MDashboardSummary and MCategoryDonut

**Files:**

- Create: `public/src/mobile/components/MDashboardSummary.tsx`
- Create: `public/src/mobile/components/MCategoryDonut.tsx`

- [ ] **Step 1: Implement `MDashboardSummary`**

```tsx
import React from 'react';
import { FormattedNumber } from 'react-intl';

interface MDashboardSummaryProps {
  entrees: number;
  sorties: number;
}

export const MDashboardSummary: React.FC<MDashboardSummaryProps> = ({ entrees, sorties }) => {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 pb-4">
      <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3">
        <p className="text-m-label font-bold text-zinc-500 uppercase tracking-wider mb-1">
          Entrées
        </p>
        <p className="text-m-title font-bold text-emerald-400 tabular-nums">
          +<FormattedNumber value={entrees} style="currency" currency="EUR" />
        </p>
      </div>
      <div className="bg-white/[0.03] border border-white/[0.05] rounded-2xl p-3">
        <p className="text-m-label font-bold text-zinc-500 uppercase tracking-wider mb-1">
          Sorties
        </p>
        <p className="text-m-title font-bold text-ruby tabular-nums">
          -<FormattedNumber value={Math.abs(sorties)} style="currency" currency="EUR" />
        </p>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Implement `MCategoryDonut`**

```tsx
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { FormattedNumber } from 'react-intl';

interface MCategoryDonutProps {
  data: { name: string; value: number; color: string }[];
  total: number;
  label: string;
}

export const MCategoryDonut: React.FC<MCategoryDonutProps> = ({ data, total, label }) => {
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-m-caption text-zinc-600 italic">Aucune donnée</p>
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={65}
            outerRadius={85}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-2">
        <p className="text-m-hero font-bold text-white tabular-nums leading-none">
          <FormattedNumber
            value={Math.abs(total)}
            style="currency"
            currency="EUR"
            maximumFractionDigits={0}
          />
        </p>
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mt-1">
          {label}
        </p>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Verify build**
      Run: `npm run typecheck`
      Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add public/src/mobile/components/MDashboardSummary.tsx public/src/mobile/components/MCategoryDonut.tsx
git commit -m "feat(mobile): add DashboardSummary and CategoryDonut components"
```

---

### Task 3: Implement MCategoryRow and Main AnalyseScreen

**Files:**

- Create: `public/src/mobile/components/MCategoryRow.tsx`
- Create: `public/src/mobile/screens/AnalyseScreen.tsx`
- Modify: `public/src/MobileApp.tsx`

- [ ] **Step 1: Implement `MCategoryRow`**

```tsx
import React from 'react';
import { FormattedNumber } from 'react-intl';
import { CategoryIcon } from '../../components/CategoryIcon';
import { getCategoryMeta } from '../../constants/categoryMetadata';

interface MCategoryRowProps {
  name: string;
  amount: number;
  percentage: number;
}

export const MCategoryRow: React.FC<MCategoryRowProps> = ({ name, amount, percentage }) => {
  const meta = getCategoryMeta(name);

  return (
    <div className="flex items-center gap-4 py-4 px-4 active:bg-white/[0.02] transition-colors">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${meta.color}15`, color: meta.color }}
      >
        <CategoryIcon icon={meta.icon} size={20} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1.5">
          <p className="text-m-title font-medium text-white truncate pr-2">{name}</p>
          <p className="text-m-title font-bold text-white tabular-nums shrink-0">
            <FormattedNumber value={Math.abs(amount)} style="currency" currency="EUR" />
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${percentage}%`, backgroundColor: meta.color }}
            />
          </div>
          <span className="text-m-caption font-bold text-zinc-500 w-9 text-right">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Implement `AnalyseScreen`**

```tsx
import React, { useMemo, useState } from 'react';
import { MScreenHeader } from '../components/MScreenHeader';
import { MMonthNavigator } from '../components/MMonthNavigator';
import { MSegmentedControl, AnalyseMode } from '../components/MSegmentedControl';
import { MDashboardSummary } from '../components/MDashboardSummary';
import { MCategoryDonut } from '../components/MCategoryDonut';
import { MCategoryRow } from '../components/MCategoryRow';
import { useTransactions } from '../../hooks/useTransactions';
import { useAppState } from '../../context/AppStateContext';
import { getCategoryMeta } from '../../constants/categoryMetadata';

export const AnalyseScreen: React.FC = () => {
  const { monthKey, setMonthKey } = useAppState();
  const { transactions, loading } = useTransactions();
  const [mode, setMode] = useState<AnalyseMode>('sorties');

  const monthTransactions = useMemo(() => {
    return transactions.filter((tx) => (tx.moisAffectation || tx.date || '').startsWith(monthKey));
  }, [transactions, monthKey]);

  const summary = useMemo(() => {
    const entrees = monthTransactions
      .filter((t) => (t.montant || 0) > 0)
      .reduce((s, t) => s + (t.montant || 0), 0);
    const sorties = monthTransactions
      .filter((t) => (t.montant || 0) < 0)
      .reduce((s, t) => s + (t.montant || 0), 0);
    return { entrees, sorties };
  }, [monthTransactions]);

  const categoryData = useMemo(() => {
    const agg: Record<string, number> = {};
    let targetTxs = monthTransactions;

    if (mode === 'entrees') {
      targetTxs = monthTransactions.filter((t) => (t.montant || 0) > 0);
    } else if (mode === 'sorties') {
      targetTxs = monthTransactions.filter((t) => (t.montant || 0) < 0);
    } else {
      // Pour récurrences, on pourrait filtrer par flag, mais ici on reste simple pour le lot 5
      // On affiche les sorties par défaut ou un filtrage spécifique si dispo
      targetTxs = monthTransactions.filter((t) => (t.montant || 0) < 0);
    }

    targetTxs.forEach((tx) => {
      const cat = tx.categorie || 'Non catégorisé';
      agg[cat] = (agg[cat] || 0) + Math.abs(tx.montant || 0);
    });

    const totalMode = Object.values(agg).reduce((s, v) => s + v, 0);

    const result = Object.entries(agg)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalMode > 0 ? (amount / totalMode) * 100 : 0,
        color: getCategoryMeta(name).color,
      }))
      .sort((a, b) => b.amount - a.amount);

    return { items: result, total: totalMode };
  }, [monthTransactions, mode]);

  const donutData = useMemo(
    () =>
      categoryData.items
        .slice(0, 8)
        .map((i) => ({ name: i.name, value: i.amount, color: i.color })),
    [categoryData],
  );

  if (loading && monthTransactions.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <MScreenHeader title="Analyse" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-8">
      <MScreenHeader title="Analyse" />

      <MMonthNavigator monthKey={monthKey} onChange={setMonthKey} />

      <MDashboardSummary entrees={summary.entrees} sorties={summary.sorties} />

      <MSegmentedControl value={mode} onChange={setMode} />

      <MCategoryDonut
        data={donutData}
        total={categoryData.total}
        label={mode === 'entrees' ? 'Total Entrées' : 'Total Sorties'}
      />

      <div className="mt-4 divide-y divide-glass-border border-t border-glass-border">
        {categoryData.items.map((item) => (
          <MCategoryRow
            key={item.name}
            name={item.name}
            amount={item.amount}
            percentage={item.percentage}
          />
        ))}

        {categoryData.items.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-m-body text-zinc-500">Aucune opération en {mode}</p>
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Update `MobileApp.tsx` routes**
      Modify `public/src/MobileApp.tsx`:
      Replace:

```tsx
import { HomeScreen } from './mobile/screens/HomeScreen';
import { PatrimoineScreen } from './mobile/screens/PatrimoineScreen';
```

With:

```tsx
import { HomeScreen } from './mobile/screens/HomeScreen';
import { PatrimoineScreen } from './mobile/screens/PatrimoineScreen';
import { AnalyseScreen } from './mobile/screens/AnalyseScreen';
```

And replace the route:

```tsx
<Route path="/analyse" element={<HomeScreen />} />
```

With:

```tsx
<Route path="/analyse" element={<AnalyseScreen />} />
```

- [ ] **Step 4: Verify build and routing**
      Run: `npm run typecheck`
      Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/src/mobile/components/MCategoryRow.tsx public/src/mobile/screens/AnalyseScreen.tsx public/src/MobileApp.tsx
git commit -m "feat(mobile): implement AnalyseScreen with donut chart and summary"
```
