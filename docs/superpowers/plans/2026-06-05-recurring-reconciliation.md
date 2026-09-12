# Rapprochement Semi-Automatique des Récurrences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a semi-automatic reconciliation mechanism in the bank feeds (Flux Bancaires) that suggests linking incoming transactions to expected recurring expenses and automates pointage.

**Architecture:** A client-side hook computes mapping matches. Approved links are persisted in Firestore under `recurrences/{id}.approvedMonths.{monthKey}` and the matched transaction is automatically marked as pointé.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Firestore, Vitest

---

### Task 1: Add `computeRecurrenceMappings` utility and tests

**Files:**

- Modify: `public/src/utils/matchRecurrence.ts`
- Modify: `public/src/utils/__tests__/matchRecurrence.test.ts`

- [ ] **Step 1: Write tests for `computeRecurrenceMappings`**

Add these tests inside the `describe('findRecurrenceMatch', ...)` or in a new block in `public/src/utils/__tests__/matchRecurrence.test.ts`:

```typescript
describe('computeRecurrenceMappings', () => {
  it('should map linked and candidate transactions correctly', () => {
    const mockRecurrences: Recurrence[] = [
      {
        id: 'rec-linked',
        label: 'Internet',
        category: 'Abonnements',
        expectedAmount: -29.99,
        dayOfMonth: 10,
        active: true,
        createdAt: Timestamp.now(),
        approvedMonths: {
          '2026-06': {
            txId: 'tx-linked',
            amount: -29.99,
            date: '2026-06-10',
            approvedAt: Date.now(),
          },
        },
      },
      {
        id: 'rec-candidate',
        label: 'EDF',
        category: 'Logement',
        expectedAmount: -80.0,
        dayOfMonth: 5,
        active: true,
        createdAt: Timestamp.now(),
      },
    ];

    const mockTransactions: Transaction[] = [
      {
        id: 'tx-linked',
        category: 'Abonnements',
        amount: -29.99,
        montant: -29.99,
        categorie: 'Abonnements',
        date: '2026-06-10T10:00:00Z',
        libelle: 'Internet FIBRE',
      },
      {
        id: 'tx-candidate',
        category: 'Logement',
        amount: -78.5,
        montant: -78.5,
        categorie: 'Logement',
        date: '2026-06-06T08:00:00Z',
        libelle: 'EDF PRLEVT',
      },
    ];

    const result = computeRecurrenceMappings(mockRecurrences, mockTransactions, '2026-06');

    expect(result.linkedTxToRecurrence['tx-linked']).toBe(mockRecurrences[0]);
    expect(result.candidateTxToRecurrence['tx-candidate']).toBe(mockRecurrences[1]);
  });
});
```

Make sure to import `computeRecurrenceMappings` from `../matchRecurrence` at the top of the test file.

- [ ] **Step 2: Run tests to verify import fails**

Run: `npx vitest run public/src/utils/__tests__/matchRecurrence.test.ts`
Expected: Compilation failure because `computeRecurrenceMappings` is not exported from `../matchRecurrence`.

- [ ] **Step 3: Implement `computeRecurrenceMappings` in `matchRecurrence.ts`**

Modify `public/src/utils/matchRecurrence.ts` by appending this at the end:

```typescript
export interface RecurrenceMappings {
  linkedTxToRecurrence: Record<string, Recurrence>;
  candidateTxToRecurrence: Record<string, Recurrence>;
}

export function computeRecurrenceMappings(
  recurrences: Recurrence[],
  monthTransactions: Transaction[],
  monthKey: string,
): RecurrenceMappings {
  const linkedTxToRecurrence: Record<string, Recurrence> = {};
  const candidateTxToRecurrence: Record<string, Recurrence> = {};

  const activeRecurrences = recurrences.filter((r) => r.active);
  const unlinkedTransactions = [...monthTransactions];

  // 1. First, map linked transactions from approved months
  activeRecurrences.forEach((rec) => {
    const approval = rec.approvedMonths?.[monthKey];
    if (approval && approval.txId) {
      linkedTxToRecurrence[approval.txId] = rec;
      // Remove this tx from candidate search
      const idx = unlinkedTransactions.findIndex((t) => t.id === approval.txId);
      if (idx !== -1) unlinkedTransactions.splice(idx, 1);
    }
  });

  // 2. For recurrences that are NOT approved/paid this month, find match candidates
  activeRecurrences.forEach((rec) => {
    const approval = rec.approvedMonths?.[monthKey];
    if (!approval) {
      const match = findRecurrenceMatch(rec, unlinkedTransactions);
      if (match) {
        candidateTxToRecurrence[match.id] = rec;
        // Do not double-match the same transaction
        const idx = unlinkedTransactions.findIndex((t) => t.id === match.id);
        if (idx !== -1) unlinkedTransactions.splice(idx, 1);
      }
    }
  });

  return { linkedTxToRecurrence, candidateTxToRecurrence };
}
```

- [ ] **Step 4: Run tests to verify it passes**

Run: `npx vitest run public/src/utils/__tests__/matchRecurrence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

Run: `git add public/src/utils/matchRecurrence.ts public/src/utils/__tests__/matchRecurrence.test.ts`
Run: `git commit -m "feat(reconciliation): add computeRecurrenceMappings and tests"`

---

### Task 2: Create custom hook `useRecurrenceReconciliation.ts`

**Files:**

- Create: `public/src/hooks/useRecurrenceReconciliation.ts`

- [ ] **Step 1: Write minimal implementation**

Write `public/src/hooks/useRecurrenceReconciliation.ts`:

```typescript
import { useState, useMemo } from 'react';
import { useGlobalData } from '../context/GlobalDataContext';
import { useTransactions } from './useTransactions';
import { useAppState } from '../context/AppStateContext';
import { computeRecurrenceMappings } from '../utils/matchRecurrence';
import { approveRecurrenceMatch, unapproveRecurrenceMonth } from './recurrencesService';
import { Recurrence, Transaction } from '../types/banking.types';

export function useRecurrenceReconciliation() {
  const { recurrences } = useGlobalData();
  const { transactions, togglePointe } = useTransactions();
  const { monthKey } = useAppState();

  // Track locally dismissed transaction matches for the current session
  const [ignoredTxIds, setIgnoredTxIds] = useState<string[]>([]);

  const monthTransactions = useMemo(() => {
    return transactions.filter((t) => (t.date || '').slice(0, 7) === monthKey);
  }, [transactions, monthKey]);

  const { linkedTxToRecurrence, candidateTxToRecurrence } = useMemo(() => {
    return computeRecurrenceMappings(recurrences, monthTransactions, monthKey);
  }, [recurrences, monthTransactions, monthKey]);

  const ignoreTxMatch = (txId: string) => {
    setIgnoredTxIds((prev) => [...prev, txId]);
  };

  const linkTxToRecurrence = async (tx: Transaction, recurrence: Recurrence) => {
    try {
      // 1. Persist the link approval in recurrences collection
      await approveRecurrenceMatch(recurrence.id, monthKey, tx);
      // 2. Mark transaction as pointed
      await togglePointe(tx.id, true);
    } catch (err) {
      console.error('Error linking transaction to recurrence:', err);
      throw err;
    }
  };

  const unlinkTxFromRecurrence = async (txId: string, recurrenceId: string) => {
    try {
      await unapproveRecurrenceMonth(recurrenceId, monthKey);
    } catch (err) {
      console.error('Error unlinking transaction from recurrence:', err);
      throw err;
    }
  };

  return {
    linkedTxToRecurrence,
    candidateTxToRecurrence,
    ignoredTxIds,
    ignoreTxMatch,
    linkTxToRecurrence,
    unlinkTxFromRecurrence,
  };
}
```

- [ ] **Step 2: Commit**

Run: `git add public/src/hooks/useRecurrenceReconciliation.ts`
Run: `git commit -m "feat(reconciliation): add useRecurrenceReconciliation custom hook"`

---

### Task 3: Display Suggestions & Badges Inline in the Transactions Feed

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumTransactionsPage.tsx`

- [ ] **Step 1: Integrate hook and UI Elements**

Modify `public/src/components/dashboard/v2/AurumTransactionsPage.tsx` to:

1. Import `useRecurrenceReconciliation`.
2. Retrieve reconciliation helpers.
3. Show inline card for candidate matches.
4. Show persistent badge for linked transactions.

Here are the replacements needed:

Add imports:

```typescript
import { useRecurrenceReconciliation } from '../../../hooks/useRecurrenceReconciliation';
```

At the beginning of `AurumTransactionsPage`:

```typescript
const {
  linkedTxToRecurrence,
  candidateTxToRecurrence,
  ignoredTxIds,
  ignoreTxMatch,
  linkTxToRecurrence,
} = useRecurrenceReconciliation();
```

Inside the `.map((tx) => ...)` loop for rendering each transaction card, wrap the transaction card in a container to display the banner underneath it, or display it inside the transaction card:

```typescript
                <div key={tx.id} className="space-y-2">
                  <motion.div
                    variants={itemVariants}
                    whileHover={{
                      y: -4,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      boxShadow: '0 30px 60px -12px rgba(0,0,0,0.5)',
                    }}
                    onClick={() => setSelectedTx(tx)}
                    className="group flex items-center justify-between px-6 py-10 rounded-xl bg-white/[0.02] border border-white/[0.04] transition-all cursor-pointer overflow-visible"
                  >
                    <div className="flex items-center gap-6 max-w-[65%]">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
                        <CategoryIcon
                          icon={getCategoryMeta(tx.categorie || '').icon}
                          size={24}
                          color={getCategoryMeta(tx.categorie || '').color}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-semibold text-white tracking-tight">
                            {tx.libelle || tx.merchantName || 'Transaction sans libellé'}
                          </p>
                          {tx.pointe && (
                            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-zinc-500 mt-1 uppercase tracking-wider">
                          {tx.categorie || tx.category || 'Autre'} •{' '}
                          {tx.compte || tx.accountId || 'Compte inconnu'}
                        </p>

                        {/* Persistent badge if linked */}
                        {linkedTxToRecurrence[tx.id] && (
                          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                            <span>✓</span> Lié à : {linkedTxToRecurrence[tx.id].label}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <p
                        className={`font-serif text-[17px] font-bold tabular-nums shrink-0 ${(tx.montant || 0) > 0 ? 'text-[#D4AF37]' : 'text-[#EDEDED]'}`}
                      >
                        {(tx.montant || 0) > 0 ? '+' : ''}
                        {formatCurrency(tx.montant || 0)}
                      </p>
                    </div>
                  </motion.div>

                  {/* Suggestion banner */}
                  {candidateTxToRecurrence[tx.id] && !ignoredTxIds.includes(tx.id) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mx-2 p-4 rounded-xl bg-gold/5 border border-gold/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">🔗</span>
                        <p className="text-xs font-semibold text-gold-light">
                          Correspondance détectée avec la récurrence <strong className="text-white">{candidateTxToRecurrence[tx.id].label}</strong> (prévue le {candidateTxToRecurrence[tx.id].dayOfMonth})
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => linkTxToRecurrence(tx, candidateTxToRecurrence[tx.id])}
                          className="px-4 py-1.5 rounded-lg bg-gold text-ink-deep text-xs font-black uppercase tracking-wider hover:bg-gold-light transition-all shadow-md shadow-gold/10"
                        >
                          Lier & Pointer
                        </button>
                        <button
                          onClick={() => ignoreTxMatch(tx.id)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs font-black uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all"
                        >
                          Ignorer
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
```

- [ ] **Step 2: Commit**

Run: `git add public/src/components/dashboard/v2/AurumTransactionsPage.tsx`
Run: `git commit -m "feat(reconciliation): display inline matching suggestions in feed"`

---

### Task 4: Integrate Suggestions & Link/Unlink in the Transaction Detail Modal

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumTransactionDetail.tsx`

- [ ] **Step 1: Implement Suggestion & Unlinking option inside detail modal**

Modify `public/src/components/dashboard/v2/AurumTransactionDetail.tsx`:

1. Use the `useRecurrenceReconciliation` hook inside the detail modal.
2. Render matching controls or status.

Add imports:

```typescript
import { useRecurrenceReconciliation } from '../../../hooks/useRecurrenceReconciliation';
```

At the top of the component:

```typescript
const {
  linkedTxToRecurrence,
  candidateTxToRecurrence,
  linkTxToRecurrence,
  unlinkTxFromRecurrence,
} = useRecurrenceReconciliation();
```

Inside the Modal body (for example, right after the Pointe status toggle section, around line 70):

```typescript
        {/* Suggestion / Link state in details */}
        {linkedTxToRecurrence[transaction.id] && (
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/15 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400">✓</span>
              <p className="text-xs font-semibold text-emerald-400">
                Lié à la récurrence : <strong className="text-white">{linkedTxToRecurrence[transaction.id].label}</strong>
              </p>
            </div>
            <button
              onClick={async () => {
                await unlinkTxFromRecurrence(transaction.id, linkedTxToRecurrence[transaction.id].id);
                onClose();
              }}
              className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[10px] font-black uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all"
            >
              Délier
            </button>
          </div>
        )}

        {candidateTxToRecurrence[transaction.id] && !linkedTxToRecurrence[transaction.id] && (
          <div className="p-4 rounded-xl bg-gold/5 border border-gold/15 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-gold">🔗</span>
              <p className="text-xs font-semibold text-gold-light">
                Cette transaction correspond à la récurrence <strong className="text-white">{candidateTxToRecurrence[transaction.id].label}</strong>.
              </p>
            </div>
            <button
              onClick={async () => {
                await linkTxToRecurrence(transaction, candidateTxToRecurrence[transaction.id]);
                onClose();
              }}
              className="w-full py-2 rounded-lg bg-gold text-ink-deep text-xs font-black uppercase tracking-wider hover:bg-gold-light transition-all shadow-md shadow-gold/10"
            >
              Lier à la récurrence & Pointer
            </button>
          </div>
        )}
```

- [ ] **Step 2: Commit**

Run: `git add public/src/components/dashboard/v2/AurumTransactionDetail.tsx`
Run: `git commit -m "feat(reconciliation): support linking and unlinking in detail panel"`
