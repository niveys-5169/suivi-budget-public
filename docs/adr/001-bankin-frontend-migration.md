# ADR-001: Bankin-Style Frontend Migration

**Status:** ACCEPTED  
**Date:** 2026-04-27  
**Decision Made By:** Product + Engineering

---

## Context

The current Suivi-Budget frontend uses:

- **Navigation:** Tab-based panels with `scrollIntoView` (legacy pattern)
- **Budget UI:** List-based console (functional but not modern)
- **Design:** AURUM dark theme (gold + ink) — excellent brand

Bankin's frontend offers:

- Clean **Analyse** tab (income/expense donut charts)
- **Budget grid** with 2-column layout + mini charts
- **Category detail pages** with trends
- Professional UX with month navigation

**Goal:** Adopt Bankin's UI/UX patterns while maintaining AURUM colors, without breaking the working backend.

---

## Decision

We will migrate to **Bankin-style frontend** in 4 phases using:

1. **React Router DOM v6** for page-based navigation
2. **Feature flags** (`import.meta.env.VITE_*`) for safe coexistence
3. **Recharts** + **SVG sparklines** for charts
4. **Extended color palette** for category differentiation

### Sub-Decisions

#### 2A. Navigation Strategy: React Router DOM v6

**Chosen:** React Router v6 (+ TypeScript)

**Why:**

- Standard React ecosystem; well-maintained
- Native support for: deep-linking, browser back/forward, URL state
- Enables progressive migration (each panel → route)
- Current `scrollIntoView` pattern fights the browser platform

**Alternatives considered:**

- Mini-router with `pushState/popstate` (too fragile, reinventing wheel)
- Continue with `setState` (no deep-link, no history, breaks on refresh)

**Implementation:**

- Wrap app in `<BrowserRouter>`
- Create routes: `/`, `/analyse`, `/budgets`, `/budgets/:categoryId`, `/patrimoine`, `/transactions`
- Legacy panels remain working during transition (dual-mode routes)
- Deprecate `scrollToPanel()` once routes are stable

#### 2B. Coexistence Strategy: Build-Time Feature Flags

**Chosen:** Environment variables (`VITE_*`) with static tree-shaking

**Why:**

- Zero runtime cost (flags compiled away)
- Instant rollback (env var change + redeploy)
- No backend dependency (unlike Firestore config)
- Dev-mode override via localStorage for QA testing
- Clear audit trail (Git history of env changes)

**Alternatives considered:**

- Firestore-based runtime flags (adds latency, single point of failure)
- Git branching (slow rollback, merge complexity)
- Feature flag library (Unleash/LaunchDarkly) (overkill, needs backend)

**Implementation:**

```typescript
// lib/featureFlags.ts
export const FLAGS = {
  ANALYSE_PAGE: import.meta.env.VITE_ANALYSE_PAGE === 'true',
  BUDGET_BANKIN: import.meta.env.VITE_BUDGET_BANKIN === 'true',
  BOTTOMNAV_V2: import.meta.env.VITE_BOTTOMNAV_V2 === 'true',
} as const;
```

- `.env.local`: Development defaults (all `false`)
- `.env.production`: Production defaults (all `false` initially)
- Firebase Hosting env vars: Gradual rollout per environment
- `localStorage` override: QA testing without rebuild

**Lifecycle:**

1. Flag added as `false` (new code dormant)
2. Dev testing with `localStorage` override
3. Enable on staging/beta tier
4. Enable on prod (after 1 week monitoring)
5. Remove flag entirely (cleanup PR)

#### 2C. Chart Library: Recharts + SVG Sparklines

**Chosen:**

- Recharts for complex charts (donut, area)
- Custom SVG paths for mini-sparklines
- Plan future removal of Chart.js (when fully migrated)

**Why:**

- **Recharts:** React-native, composable, CSS-in-JS friendly, perfect for custom Bankin-style design (segmented donuts, labels)
- **SVG sparklines:** 30 lines of code, instant render, zero dependencies, perfect for grid mini-charts
- **Chart.js removed:** Reduces bundle by ~80 kB when no longer needed

**Alternatives considered:**

- Chart.js only (faster, but canvas hard to style pixel-perfectly)
- Recharts only for sparklines (overkill, heavy)
- D3.js (too complex, larger bundle)

**Implementation:**

- `DonutChart.tsx` → Recharts (Pie with inner radius)
- `AreaChart.tsx` → Recharts (Area for main trends)
- `AreaSparkline.tsx` → Native SVG (mini trends in grid)
- Phase 2: Deprecate/remove `react-chartjs-2` import

#### 2D. Category Colors: Extended AURUM Palette

**Chosen:** Add `category-colors` token to design system

**Why:**

- Bankin uses distinct colors per category (improves scanning)
- Dark mode compatible (desaturated, not neon)
- Extends AURUM without breaking existing gold-only rules
- Optional: falls back to gold if not specified

**Colors added to `tailwind.config.js`:**

```javascript
categoryColors: {
  housing:       '#6B5B95',   // Purple
  transport:     '#00A8A8',   // Teal
  food:          '#C8956F',   // Warm brown
  health:        '#E98080',   // Soft red
  entertainment: '#F5A962',   // Orange
  shopping:      '#D9A4B8',   // Mauve
  utilities:     '#88A4C2',   // Blue-grey
  other:         '#8B8B8B',   // Grey
}
```

**Usage:**

- `CategoryIcon.tsx` uses `categoryColors[category.key]` if defined, else `gold`
- Donut chart colors: same palette
- Grid cards: border + accent in category color, desaturated on dark

---

## Consequences

### ✅ Positive

1. **User experience:** Professional Bankin-like UI/UX
2. **Design consistency:** Unified styling across pages
3. **Safe rollout:** Feature flags enable gradual activation
4. **Backend unchanged:** No API, no database schema changes
5. **Performance:** Tree-shaken dead code, SVG sparklines are fast
6. **DX:** React Router is standard, easier for future devs

### ⚠️ Negative / Mitigations

| Risk                                         | Mitigation                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| React Router adds complexity                 | Use simple routes (no nested complex guards), progressive adoption               |
| Feature flags can be mismanaged              | Document in `FEATURE_FLAGS.md`, require code review for activation               |
| Extended palette could clash with dark theme | QA review on all category colors against dark bg, use tool like Contrast Checker |
| Tree-shaking relies on Rollup                | Verify in `npm run build`, inspect dist/assets/\*.js for unused code presence    |

---

## Implementation Plan

### Phase 0: Decisions & Setup (Day 1)

- [ ] Create `lib/featureFlags.ts`
- [ ] Add `.env.local` and `.env.production`
- [ ] Update `tailwind.config.js` with category colors
- [ ] Add `DESIGN_SYSTEM.md` section on category colors
- [ ] Install React Router: `npm install react-router-dom`

### Phase 1: Shared Components (Day 2–3)

- [ ] `MonthNavigator.tsx` with prev/next, date range calc
- [ ] `DonutChart.tsx` (Recharts Pie with custom center)
- [ ] `AreaSparkline.tsx` (SVG path, no deps)
- [ ] Tests for all 3 components

### Phase 2: Analyse Page (Day 4–5)

- [ ] `AnalyseSection.tsx` with tabs (Entrées/Sorties/Récurrences)
- [ ] `AnalyseDonutCard.tsx`
- [ ] `AnalyseCategoryRow.tsx`
- [ ] Route `/analyse` in React Router
- [ ] Tests

### Phase 3: Budget Redesign (Day 6–7)

- [ ] `BankinBudgetMain.tsx` (header + area chart + grid)
- [ ] `BankinBudgetGrid.tsx` (2-column category cards)
- [ ] `BankinBudgetCategoryDetail.tsx` (detail page)
- [ ] Navigation state machine in `BudgetsPage.tsx`
- [ ] Route `/budgets/:categoryId`
- [ ] Tests

### Phase 4: Navigation & Cleanup (Day 8)

- [ ] Add React Router root wrapper
- [ ] Update `BottomNav.tsx` to use Link (RR)
- [ ] Migrate `scrollToPanel()` calls to `navigate()`
- [ ] Feature flags: set `BUDGET_BANKIN=true` on staging
- [ ] Manual QA on mobile (375px) and desktop

### Phase 5: Stabilization & Removal (Week 2)

- [ ] 1 week monitoring in production
- [ ] Disable feature flags: set to `true` everywhere
- [ ] Remove conditional code (keep new paths only)
- [ ] Remove `react-chartjs-2` from package.json
- [ ] Cleanup PR

---

## Approval

- **Frontend Owner:** [Approved]
- **Backend Owner:** [Acknowledged — no changes needed]
- **Design:** [Confirms colors + layout match Bankin intent]

---

## References

- Bankin screenshots (shared in task)
- Current code: `public/src/components/budgets-v2/`
- DESIGN_SYSTEM.md
- GEMINI.md (project rules)
- React Router docs: https://reactrouter.com/
- Vite env vars: https://vitejs.dev/guide/env-and-modes.html
