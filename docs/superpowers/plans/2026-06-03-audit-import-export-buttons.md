# Audit Import/Export Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create visible, dedicated Audit import/export buttons positioned alongside the Snapshot button in the Patrimoine (Wealth) dashboard.

**Architecture:** Create two reusable button components (`AuditExportButton` & `AuditImportButton`) with proper styling and visibility. Move them to the right side of the button group next to Snapshot, replacing the nearly-invisible existing Import button. The components will reuse existing modal and export utilities.

**Tech Stack:** React + TypeScript, Lucide Icons, Tailwind CSS (text-gold for visibility), existing `PositionsImportModal` and `exportPlacementHistory` utilities.

---

## File Structure

**Files to modify/create:**

- Create: `public/src/components/dashboard/v2/AuditExportButton.tsx` — Export audit history button component
- Create: `public/src/components/dashboard/v2/AuditImportButton.tsx` — Import audit history button component
- Modify: `public/src/components/dashboard/v2/AurumWealthPage.tsx` — Remove old buttons, integrate new ones next to Snapshot

---

### Task 1: Create AuditExportButton component

**Files:**

- Create: `public/src/components/dashboard/v2/AuditExportButton.tsx`

- [ ] **Step 1: Create the component file with proper imports and types**

```typescript
import React from 'react';
import { Download } from 'lucide-react';
import { exportPlacementHistory } from '../../../utils/positionsHistoryExcel';
import type { PlacementHistoryEntry } from '../../../hooks/usePatrimoine';

interface AuditExportButtonProps {
  placementHistory: PlacementHistoryEntry[];
}

export const AuditExportButton: React.FC<AuditExportButtonProps> = ({ placementHistory }) => {
  return (
    <button
      onClick={() => exportPlacementHistory(placementHistory)}
      disabled={!placementHistory?.length}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gold/10 border border-gold/20 text-gold text-label font-black uppercase tracking-widest hover:bg-gold/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      title="Exporter l'audit patrimonial en Excel"
    >
      <Download size={12} />
      Export Audit
    </button>
  );
};
```

- [ ] **Step 2: Verify the file compiles with `npm run build`**

```bash
npm run build
```

Expected: No TypeScript errors for the new component.

- [ ] **Step 3: Commit**

```bash
git add public/src/components/dashboard/v2/AuditExportButton.tsx
git commit -m "feat(audit): create AuditExportButton component"
```

---

### Task 2: Create AuditImportButton component

**Files:**

- Create: `public/src/components/dashboard/v2/AuditImportButton.tsx`

- [ ] **Step 1: Create the component file**

```typescript
import React from 'react';
import { Upload } from 'lucide-react';

interface AuditImportButtonProps {
  onClick: () => void;
}

export const AuditImportButton: React.FC<AuditImportButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gold/10 border border-gold/20 text-gold text-label font-black uppercase tracking-widest hover:bg-gold/20 transition-all"
      title="Importer un audit patrimonial en Excel"
    >
      <Upload size={12} />
      Import Audit
    </button>
  );
};
```

- [ ] **Step 2: Verify the file compiles**

```bash
npm run build
```

Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add public/src/components/dashboard/v2/AuditImportButton.tsx
git commit -m "feat(audit): create AuditImportButton component"
```

---

### Task 3: Integrate new buttons into AurumWealthPage

**Files:**

- Modify: `public/src/components/dashboard/v2/AurumWealthPage.tsx:1-25` (imports)
- Modify: `public/src/components/dashboard/v2/AurumWealthPage.tsx:225-257` (button layout)

- [ ] **Step 1: Add imports for new button components**

After line 11 (after `import { PositionsImportModal }`), add:

```typescript
import { AuditExportButton } from './AuditExportButton';
import { AuditImportButton } from './AuditImportButton';
```

- [ ] **Step 2: Replace the button group in the "Performance Patrimoniale" section**

Find the button group starting at line 225. Replace lines 225-257 with:

```typescript
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <History size={18} className="text-gold" />
              <h3 className="text-xl font-bold tracking-tight">Performance Patrimoniale</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/40 text-label font-black uppercase tracking-widest hover:text-gold hover:border-gold/20 transition-all"
              >
                <History size={12} />
                Historique
              </button>
              <AuditExportButton placementHistory={placementHistory} />
              <AuditImportButton onClick={() => setShowImportModal(true)} />
              <button
                onClick={() => setShowSnapshotModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gold/10 border border-gold/20 text-gold text-label font-black uppercase tracking-widest hover:bg-gold/20 transition-all"
              >
                <Clock size={12} />
                Snapshot
              </button>
            </div>
          </div>
```

- [ ] **Step 3: Verify the component renders without errors**

```bash
npm run dev
```

Navigate to the Patrimoine page and visually verify:

- Export Audit button is visible and gold-colored
- Import Audit button is visible and gold-colored
- Both are positioned to the right of "Historique"
- Snapshot button is still at the far right
- Buttons are clickable and don't show TypeScript errors in console

- [ ] **Step 4: Commit**

```bash
git add public/src/components/dashboard/v2/AurumWealthPage.tsx
git commit -m "feat(audit): integrate AuditExportButton and AuditImportButton components"
```

---

### Task 4: Verify export/import functionality works

**Files:**

- Test: Manual verification (no test file needed for UI button integration)

- [ ] **Step 1: Test Export Audit button**

In the running dev server:

1. Navigate to Patrimoine page
2. Scroll to "Performance Patrimoniale" section
3. Click "Export Audit" button
4. Verify Excel file downloads with naming pattern `placement_history_*.xlsx`
5. Open the file and verify it contains placement history data

Expected: File downloads successfully and contains correct columns (Date, Nom, Montant, Type, Owner, etc.)

- [ ] **Step 2: Test Import Audit button**

1. In the same section, click "Import Audit" button
2. Verify `PositionsImportModal` opens
3. Upload a valid Excel file with the correct format
4. Verify the import preview shows new/updated entries
5. Click "Valider l'import" and verify data is imported to Firestore

Expected: Modal opens, file parses correctly, import succeeds without errors

- [ ] **Step 3: Verify styling consistency**

1. Hover over Export Audit button → should turn darker gold
2. Hover over Import Audit button → should turn darker gold
3. Compare with Snapshot button styling → should match
4. Verify buttons are readable (not too transparent like the old Import button)

Expected: All buttons have consistent styling and are clearly visible

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(audit): verify export/import functionality and styling"
```

---

## Summary

This plan creates dedicated, visible audit import/export buttons using new reusable components. The buttons are styled consistently with the Snapshot button (gold theme) and positioned logically in the Performance Patrimoniale section, making them discoverable and easy to use.
