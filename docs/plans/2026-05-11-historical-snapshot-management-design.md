# Historical Snapshot Management Design

**Goal:** Provide a robust, table-based interface to view, edit, and add historical wealth snapshots by asset, ensuring data integrity and ease of verification.

## 1. Interface & Interaction

- **Modal Container:** A large, specialized modal ("Aurum History Manager") matching the premium dark aesthetic.
- **Asset Selector:** A dropdown at the top to switch between assets. Selecting an asset filters the table below to show only its history.
- **Data Table:**
  - **Columns:** Date (readonly for existing, date-picker for new), Owner (readonly), Type (readonly), Amount (inline-editable).
  - **Inline Editing:** Clicking an amount transforms the cell into a numeric input.
  - **Visual Cues:** Modified rows are highlighted (e.g., gold border or left accent). Invalid inputs show red.
- **Row Actions:** A "Delete" icon (trash) for each row to remove entries.
- **Bulk Save:** A floating or bottom-anchored "Save Changes" button that tracks the delta (modified/added/deleted).

## 2. Functionality & Logic

- **Add Snapshot:** A "+ Add Snapshot" button creates a new row.
  - Pre-fills `owner` and `type` from the current asset's metadata.
  - Default date is `today`.
- **Duplicate Prevention:** Before saving, check if multiple entries exist for the same `assetId` and `date`. If so, merge them or warn the user.
- **State Management:**
  - Use a local state (array of objects) cloned from Firestore.
  - Track `originalValue` to detect changes.
  - Track `deletedIds` to perform batch deletions.
- **Firebase Integration:**
  - Fetch history via `placement_history` collection.
  - Save using `writeBatch` for atomicity.

## 3. Aesthetic Integration

- Consistent with `DESIGN_SYSTEM.md`: Ink deep backgrounds, Gold (#D4AF37) for highlights and primary actions, Platinum for text.
- Use `framer-motion` for smooth modal transitions and row entry/exit.
- Glassmorphism effects for the table header and action bar.

---

_Created: 2026-05-11_
