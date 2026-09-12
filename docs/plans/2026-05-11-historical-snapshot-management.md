# Historical Snapshot Management Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a comprehensive historical snapshot management console allowing asset-based filtering, inline editing of amounts, and batch verification/saving.

**Architecture:** A dedicated modal component `HistoryManagementModal` using local state to track deltas (adds, edits, deletes) and applying them via Firestore `writeBatch`.

**Tech Stack:** React, TypeScript, Firebase Firestore, Framer Motion, Lucide Icons.

---

### Task 1: Create History Management Modal Structure

**Files:**

- Create: `public/src/components/dashboard/v2/HistoryManagementModal.tsx`

**Step 1: Scaffolding**
Implement the basic modal shell with the "Aurum" aesthetic and the asset selector dropdown.

**Step 2: Asset Selection State**
Initialize state for `selectedAssetId` and load the list of available assets (placements + savings) as options.

**Step 3: History Fetching**
Implement an effect to fetch history entries from Firestore for the selected asset and store them in a local `rows` state.

**Step 4: Commit**
`git add public/src/components/dashboard/v2/HistoryManagementModal.tsx && git commit -m "feat: initial structure for HistoryManagementModal"`

---

### Task 2: Implement Table with Inline Editing

**Files:**

- Modify: `public/src/components/dashboard/v2/HistoryManagementModal.tsx`

**Step 1: Table Rendering**
Render a table showing Date, Amount, and Actions. Use a clean, compact layout.

**Step 2: Inline Amount Edit**
Add a state to track which cell is being edited. Show an input when active, and update the local `rows` state on blur/enter.

**Step 3: Change Tracking**
Add visual indicators (e.g., a gold border or dot) to rows that have been modified compared to their original Firestore state.

**Step 4: Commit**
`git commit -am "feat: add inline editing to history management table"`

---

### Task 3: Add and Delete Snapshots

**Files:**

- Modify: `public/src/components/dashboard/v2/HistoryManagementModal.tsx`

**Step 1: Add Row Logic**
Implement the "+ Add Snapshot" button. It should create a new object in the `rows` state with default values and pre-filled owner/type.

**Step 2: Date Picker**
Ensure the Date field for new rows is a functional HTML5 date picker.

**Step 3: Delete Logic**
Implement the trash icon action. It should remove the row from `rows` and track the ID in a `deletedIds` set for final persistence.

**Step 4: Commit**
`git commit -am "feat: implement add and delete actions in HistoryManagementModal"`

---

### Task 4: Batch Persistence and Validation

**Files:**

- Modify: `public/src/components/dashboard/v2/HistoryManagementModal.tsx`

**Step 1: Duplicate Validation**
Add a check to prevent saving multiple entries for the same date on the same asset.

**Step 2: Batch Save Implementation**
Implement the `handleSave` function using `writeBatch`. Handle modified, new, and deleted entries.

**Step 3: Success Feedback**
Add a success state with a checkmark and auto-close or refresh the data.

**Step 4: Commit**
`git commit -am "feat: implement batch save and validation for historical snapshots"`

---

### Task 5: Integration and Access Points

**Files:**

- Modify: `public/src/components/dashboard/v2/PlacementSnapshotModal.tsx`
- Modify: `public/src/components/dashboard/v2/AurumWealthPage.tsx`
- Modify: `public/src/components/WealthPage.tsx`

**Step 1: PlacementSnapshotModal Link**
Add a "Gérer l'historique" button/link in the header of the existing snapshot modal.

**Step 2: Page Integration**
Ensure both wealth pages can trigger the new `HistoryManagementModal`.

**Step 3: Verification**
Verify that all types of assets (market, savings, etc.) are correctly handled and categorized.

**Step 4: Commit**
`git commit -am "feat: integrate HistoryManagementModal into wealth pages"`
