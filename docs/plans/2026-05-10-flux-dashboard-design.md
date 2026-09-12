# Design Doc — FLUX Dashboard (Transaction Stream)

**Date:** 2026-05-10  
**Status:** Validated  
**Concept:** Approach 1 — "The Stream"

## 1. Objective

Redesign the primary transaction list into a high-end "FLUX" dashboard that prioritizes vertical rhythm, anti-overlap spacing, and ultra-legibility. The aesthetic follows the "Private Client" (Dark Premium) design system.

## 2. Layout & Grid (Anti-Overlap)

- **Global Container:** Solid `#0B0B14` (Ink Deep) background. `px-6 md:px-12` padding.
- **Vertical Spacing:**
  - `gap-y-6` (24px) between day-clusters.
  - `space-y-3` (12px) between individual transactions within a cluster.
- **Sticky Headers:** Floating date anchors using `sticky top-[80px]` with `backdrop-blur-md`.
  - _Typography:_ `text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500`.
- **Navigation Safety:** `pb-32` on the main list to prevent the floating search island from masking content.

## 3. Transaction Row (Hybrid Priority)

- **Geometry:** `min-height: 84px`. `glass-panel` surface (`#121622`). `p-5` inner padding.
- **Left Block (Metadata):**
  - **Icon:** 48x48px rounded-2xl (`bg-white/5`) with Gold (`#D4AF37`) category icon.
  - **Label:** `text-[15px] font-semibold text-white tracking-tight`. Mandatory `truncate`.
  - **Sub-line:** `text-[11px] font-medium text-zinc-500`. Format: `CATEGORIE • COMPTE`.
- **Right Block (Financial):**
  - **Typography:** `font-serif text-[17px] font-bold`.
  - **Anti-Overflow:** Maximum width for the left block (65%) ensures a 32px "No-Fly Zone" buffer before the amount.
  - **Color:** Gold (`#D4AF37`) for inflows, Platinum (`#EDEDED`) for standard outflows.

## 4. Interactivity & Motion

- **Hover:** `bg-white/[0.05]` shift, `y: -2px` lift, and a subtle shadow.
- **Entry:** Staggered vertical slide (`y: 20 -> 0`) with `opacity` fade.
- **Spring Physics:** `stiffness: 100`, `damping: 20` for all Framer Motion transitions.
- **Floating Island:** Bottom search/filter bar using `backdrop-blur-2xl` and `max-width: 600px`.

## 5. Technical Requirements

- **Framework:** React 18 with TypeScript.
- **Styling:** Tailwind CSS.
- **Animation:** Framer Motion.
- **Accessibility:** WCAG AA contrast ratios (Primary text `#EDEDED` on `#121622`).
