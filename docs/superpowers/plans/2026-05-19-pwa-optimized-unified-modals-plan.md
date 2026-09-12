# PWA-Optimized Unified Transaction Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify and optimize transaction editing by moving the "Save" action to the modal header and using the standard `TransactionFormModal` everywhere, including the Analysis section.

**Architecture:**

1. Enhance the generic `Modal` component to support header actions.
2. Refactor `TransactionFormModal` to move primary actions to the header and optimize form layout.
3. Replace custom drill-down views in `AnalyseSection` with the unified `TransactionFormModal`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, React Hook Form.

---

### Task 1: Enhance Base Modal Component

**Files:**

- Modify: `public/src/components/shared/Modal.tsx`

- [ ] **Step 1: Update `ModalProps` interface**
      Add `headerActions` optional prop.

```typescript
interface ModalProps {
  // ... existing props
  headerActions?: React.ReactNode;
}
```

- [ ] **Step 2: Update `Modal` component implementation**
      Destructure `headerActions` and render it in the header, to the left of the close button.

```tsx
// Inside Modal component...
<div className="flex items-center justify-between p-8 border-b border-white/5 sticky top-0 bg-ink/90 backdrop-blur-md z-10 flex-shrink-0">
  <div className="flex flex-col">{/* ... Title and Subtitle ... */}</div>
  <div className="flex items-center gap-3">
    {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
    <button
      type="button"
      className="min-w-[44px] min-h-[44px] flex items-center justify-center
                 rounded-2xl bg-glass border border-glass-border
                 text-zinc-600 hover:text-white transition-all"
      onClick={onClose}
      aria-label="Fermer"
    >
      <X size={18} aria-hidden="true" />
    </button>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add public/src/components/shared/Modal.tsx
git commit -m "feat(ui): add headerActions support to Modal component"
```

---

### Task 2: Refactor TransactionFormModal for Header-based Actions

**Files:**

- Modify: `public/src/components/TransactionFormModal.tsx`

- [ ] **Step 1: Extract "Save" button to a reusable component/variable**
      Create the `SaveButton` to be passed to `headerActions`.

```tsx
const SaveButton = (
  <button
    type="submit"
    form="transaction-form" // Ensure the form has this ID
    disabled={isSubmitting || isDeleting}
    className="h-11 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest bg-gold text-ink hover:bg-gold-light disabled:opacity-50 transition-all shadow-lg shadow-gold/20 flex items-center justify-center gap-2"
  >
    {isSubmitting ? (
      t({ id: 'state.saving' })
    ) : (
      <>
        <Save size={14} aria-hidden="true" />
        {transaction ? t({ id: 'tx.form.save.edit' }) : t({ id: 'tx.form.save.new' })}
      </>
    )}
  </button>
);
```

- [ ] **Step 2: Update `Modal` usage and Form structure**
      Add `id="transaction-form"` to the form, pass `headerActions={SaveButton}`, and update the footer.

```tsx
<Modal
  isOpen={isOpen}
  onClose={onClose}
  title={modalTitle}
  subtitle={t({ id: 'tx.form.subtitle' })}
  headerActions={SaveButton}
>
  <form id="transaction-form" onSubmit={handleSubmit(onSubmit)} className="p-8 pb-4" ...>
    {/* ... form fields ... */}

    <div className="flex items-center gap-4 mt-8 pt-8 border-t border-white/5 pb-2 mb-safe">
       {transaction?.id && onDelete && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSubmitting || isDeleting}
          className="flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-ruby/10 border border-ruby/30 text-ruby hover:bg-ruby/20 transition-all flex items-center justify-center gap-2"
        >
          <Trash2 size={14} aria-hidden="true" />
          {isDeleting ? 'Suppression...' : 'Supprimer'}
        </button>
      )}
      <button
        type="button"
        className="flex-1 h-12 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-glass border border-glass-border text-zinc-500 hover:text-white transition-all"
        onClick={onClose}
      >
        {t({ id: 'action.cancel' })}
      </button>
    </div>
  </form>
</Modal>
```

- [ ] **Step 3: Increase Form Density**
      Reduce gap sizes and padding to minimize scrolling.
      Modify `grid-cols-1 sm:grid-cols-2 gap-6` to `gap-4`. Reduce `mb-6` to `mb-4`.

- [ ] **Step 4: Commit**

```bash
git add public/src/components/TransactionFormModal.tsx
git commit -m "refactor(ui): move transaction save to modal header and optimize layout"
```

---

### Task 3: Harmonize Analysis Section with Unified Modal

**Files:**

- Modify: `public/src/components/analyse/AnalyseSection.tsx`

- [ ] **Step 1: Add necessary states and handlers for `TransactionFormModal`**
      Import `TransactionFormModal` and add state for `isEditModalOpen` and `editingTransaction`.

```tsx
import { TransactionFormModal } from '../TransactionFormModal';
// ...
const [isEditModalOpen, setIsEditModalOpen] = useState(false);
const [editingTransaction, setEditingTransaction] = useState<any>(null);
const { saveTransaction, deleteTransaction } = useTransactions();
```

- [ ] **Step 2: Update `handleRowClick` or relevant trigger**
      Instead of opening a drill-down for individual transactions, open the modal.

- [ ] **Step 3: Update `AnalyseRecurrencesPanel` or Drill-down components**
      Ensure that clicking a transaction in the history of a recurrence drill-down opens the `TransactionFormModal`.

- [ ] **Step 4: Commit**

```bash
git add public/src/components/analyse/AnalyseSection.tsx
git commit -m "feat(analyse): use unified TransactionFormModal for editing transactions"
```

---

### Task 4: Final Verification

- [ ] **Step 1: Manual Visual Test**
      Open a transaction from the Dashboard, verify "Enregistrer" is in the header.
      Open a transaction from Analysis > Sorties > Catégorie, verify it opens the same modal.
      Open a transaction from Analysis > Récurrences > Historique, verify it opens the same modal.

- [ ] **Step 2: PWA/Mobile Simulation**
      Test in responsive mode (375x812), verify the "Enregistrer" button is accessible and the keyboard doesn't hide primary actions.

- [ ] **Step 3: Run Lint**
      Run: `npm run lint`
      Expected: PASS (ignore unrelated warnings)
