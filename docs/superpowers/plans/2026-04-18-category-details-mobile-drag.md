# Plan: Category Detail Modal + Mobile Drag Handle

**Date:** 2026-04-18  
**Branch:** claude/category-details-mobile-drag-4pHmO

---

## Goal

Improve the budget category tiles so that clicking opens a clear entrées/sorties breakdown modal, and mobile drag-and-drop requires an intentional long-press via a dedicated handle.

---

## Scope

**In scope:**

- `BudgetDashboardModal.tsx`: replace flat transaction table with two sections (Sorties / Entrées), each showing total + list sorted newest-first, hidden if empty
- `SortableCategoryTile.tsx`: add always-visible grip handle (⠿), move `{...listeners}` + `touchAction:'none'` to handle only, keep `onClick` on main tile

**Out of scope:**

- Redesigning the tile layout or KPI stats
- Adding a "Compte" column
- Changing drag persistence logic (localStorage order stays)
- Any changes to `BudgetDashboard.tsx`

---

## Implementation Steps

1. **Modify `BudgetDashboardModal.tsx`**
   - Compute `sorties` = transactions where `montant < 0`, sorted by date descending
   - Compute `entrees` = transactions where `montant >= 0`, sorted by date descending
   - Compute `totalSorties` = sum of `Math.abs(montant)` for sorties
   - Compute `totalEntrees` = sum of montant for entrées
   - Replace the existing `<div className="modal-transactions">` block with two section blocks:
     - **Sorties** section: title row showing "Sorties" + total in red; table with Date / Libellé / Montant; hidden if `sorties.length === 0`
     - **Entrées** section: title row showing "Entrées" + total in green; same table structure; hidden if `entrees.length === 0`
   - Update CSS inside the `<style>` tag: add `.section-header`, `.section-total` classes

2. **Modify `SortableCategoryTile.tsx`**
   - Remove `touchAction: 'none'` from the main tile `style` object
   - Remove `{...attributes}` and `{...listeners}` from the main `<div>`
   - Add a drag handle `<div>` inside the tile (top-right corner, absolute or flex):
     - Apply `{...attributes}` and `{...listeners}` to this handle div only
     - Style: `touchAction: 'none'`, `cursor: isDragging ? 'grabbing' : 'grab'`, small gray grip icon `⠿`
     - `onClick` on handle: `e.stopPropagation()` to prevent bubbling to tile click
   - Main tile `<div>` retains `onClick={() => !isDragging && onClick(cat)}`
   - Main tile cursor: `pointer`

---

## Files to Modify

| File                                             | Action | Purpose                                           |
| ------------------------------------------------ | ------ | ------------------------------------------------- |
| `public/src/components/BudgetDashboardModal.tsx` | modify | Two-section (Sorties/Entrées) transaction layout  |
| `public/src/components/SortableCategoryTile.tsx` | modify | Dedicated drag handle, fix mobile accidental drag |

---

## Risks and Mitigations

| Risk                                                | Mitigation                                                                                     |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Drag stops working after moving listeners to handle | Test both mouse and touch drag after change; `{...attributes}` must stay with `{...listeners}` |
| Click on handle accidentally opens modal            | Add `e.stopPropagation()` on handle's onClick                                                  |
| Modal % calculation breaks when budget = 0          | Already guarded with `category.budget > 0` check; keep existing guard                          |
| Sorties/Entrées both empty (no transactions)        | Keep existing "Aucune transaction" fallback shown when both arrays are empty                   |

---

## Open Questions

None — all confirmed by user:

- Drag handle: always visible ✓
- Empty sections: hidden ✓
- Sort order: newest first ✓
- No Compte column ✓
