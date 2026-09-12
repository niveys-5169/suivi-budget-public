# Bankin Frontend Migration — START HERE

You're implementing a modern Bankin-style UI for Suivi-Budget while keeping the excellent AURUM dark theme and gold accents.

---

## What's Already Done (For You)

✅ **Architecture Decisions Made:**

- Navigation: React Router v6
- Feature Flags: Vite environment variables (`VITE_*`)
- Charts: Recharts + SVG sparklines
- Colors: Extended AURUM palette with category colors

✅ **Documentation Created:**

- `docs/adr/001-bankin-frontend-migration.md` — Why we're doing this
- `docs/FEATURE_FLAGS.md` — Complete feature flags guide
- `docs/FEATURE_FLAGS_QUICK_REFERENCE.md` — Copy-paste cheat sheet
- `docs/IMPLEMENTATION_CHECKLIST.md` — Phase-by-phase checklist
- `docs/GIT_COMMIT_MESSAGES.md` — Commit message templates

✅ **Code Infrastructure Created:**

- `public/src/lib/featureFlags.ts` — Feature flags module
- `.env.production` — Production defaults
- `.env.local.example` → Copy to `.env.local` before dev

---

## Your Task: Implement Phase 0 → Phase 5

You're building **Bankin-style UI** over **5 phases** using **feature flags** for safe rollout.

---

## Phase 0: Setup (30 min — DO THIS FIRST)

### Step 1: Copy env template

```bash
cd /home/user/Suivi-Budget
cp .env.local.example .env.local
```

### Step 2: Install React Router

```bash
npm install react-router-dom
npm install -D @types/react-router-dom
```

### Step 3: Run tests to verify setup

```bash
npm test
# Should pass (featureFlags.ts has initial test)
```

### Step 4: Start dev server

```bash
npm run dev
# http://localhost:3000
```

✅ **Phase 0 complete** when:

- [ ] `.env.local` exists with all flags as `false`
- [ ] `npm test` passes
- [ ] `npm run build` has zero errors
- [ ] Dev server starts cleanly

---

## Phases 1-5: Implementation (8 days estimated)

### Phase 1: Shared Components (Days 1-2)

**Create reusable components** used by Analyse and Budget pages:

1. `MonthNavigator.tsx` — `< April 2026 >` with prev/next buttons
2. `DonutChart.tsx` — Recharts-based donut with custom center label
3. `AreaSparkline.tsx` — SVG-based mini area chart (for grid)
4. Tests for all 3

**Reference:** `docs/IMPLEMENTATION_CHECKLIST.md` Phase 1

**Commit:** `feat(shared): Add MonthNavigator, DonutChart, AreaSparkline`

---

### Phase 2: Analyse Page (Days 3-4)

**Create new Analyse tab** with Entrées/Sorties/Récurrences:

1. `AnalyseSection.tsx` — Main component mounted in `main.js`
2. `AnalyseTabs.tsx` — Tab switching
3. `AnalyseDonutCard.tsx` — Uses DonutChart
4. `AnalyseCategoryRow.tsx` — Category list rows
5. Tests

**Feature flag:** `FLAGS.ANALYSE_PAGE`

**Reference:** `docs/IMPLEMENTATION_CHECKLIST.md` Phase 2

**Commit:** `feat(analyse): Create AnalyseSection with Entrées/Sorties/Récurrences [FLAG: ANALYSE_PAGE]`

---

### Phase 3: Budget Redesign (Days 5-6)

**Redesign Budget page** in Bankin style (grid + category detail):

1. `BankinBudgetMain.tsx` — Main budget overview
   - Header with amount, progress bar
   - Area chart showing daily cumulative spending
   - Category grid below

2. `BankinBudgetGrid.tsx` — 2-column category cards
   - Each card: name, icon, spent/budget, sparkline
   - Colored border per category

3. `BankinBudgetCategoryDetail.tsx` — Detail page
   - Colored header
   - Full area chart, spending details
   - Sub-categories list

4. Navigation state machine in `BudgetsPage.tsx`

5. Tests

**Feature flag:** `FLAGS.BUDGET_BANKIN`

**Reference:** `docs/IMPLEMENTATION_CHECKLIST.md` Phase 3

**Commit:** `feat(budget-bankin): Redesign Budget page in Bankin style [FLAG: BUDGET_BANKIN]`

---

### Phase 4: React Router & Navigation (Day 7)

**Setup routing and update navigation:**

1. Wrap app in `<BrowserRouter>`
2. Create routes: `/`, `/analyse`, `/budgets`, `/budgets/:categoryId`, etc.
3. Update `BottomNav.tsx` to 5 items (add Analyse)
4. Migrate `scrollToPanel()` → `navigate()`

**Reference:** `docs/IMPLEMENTATION_CHECKLIST.md` Phase 4

**Commit:** `feat(nav): Setup React Router and 5-tab BottomNav`

---

### Phase 5: Stabilization & Cleanup (Week 2)

**Monitor, test, then remove flags:**

1. Enable flags in staging, test thoroughly
2. Enable in production, monitor for 1 week
3. Remove flags (if stable)
4. Delete conditional code

**Reference:** `docs/IMPLEMENTATION_CHECKLIST.md` Phase 5

**Commit:** `refactor(budget-bankin): Remove feature flag, make Bankin UI permanent`

---

## Key Rules

### Feature Flags

Always use:

```typescript
import { FLAGS } from '@/lib/featureFlags';

if (FLAGS.BUDGET_BANKIN) {
  return <BankinBudgetMain />;
}
return <LegacyBudgetPage />;
```

❌ Never: `if (import.meta.env.VITE_BUDGET_BANKIN === 'true')`

### Testing Locally

Enable a flag without rebuild:

```javascript
// Browser console:
localStorage.setItem('flags', JSON.stringify({ BUDGET_BANKIN: true }));
window.location.reload();
```

### Commits

Always follow:

```
feat(scope): description [FLAG: flagname]

Explains why, what problem it solves.

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

See `docs/GIT_COMMIT_MESSAGES.md` for examples.

### Tests Before Commit

```bash
npm test          # All tests pass
npm run lint      # Zero warnings
npm run build     # Zero errors
npm run dev       # Manual UI test
```

---

## Documentation You Have

- **`docs/adr/001-bankin-frontend-migration.md`** — Why this decision (architecture)
- **`docs/FEATURE_FLAGS.md`** — Complete feature flags reference
- **`docs/FEATURE_FLAGS_QUICK_REFERENCE.md`** — Copy-paste quick ref
- **`docs/IMPLEMENTATION_CHECKLIST.md`** — Phase-by-phase tasks
- **`docs/GIT_COMMIT_MESSAGES.md`** — Commit message examples
- **`DESIGN_SYSTEM.md`** — AURUM colors, styling rules

**Read these in order when starting each phase.**

---

## FAQ

### Q: Do I touch the backend?

**A:** No. All data comes from existing `useBudget()`, `useTransactions()` hooks. Zero API changes.

### Q: Will the old UI disappear?

**A:** No. Feature flags keep it as fallback. Flags default to `false`, so old code runs by default. New code is optional via env var.

### Q: What if I find a bug?

**A:** Fix it in the feature-flagged code. The old UI is still there as fallback. Rollback is instant (disable the flag).

### Q: How do I test both UI versions?

**A:** Use localStorage override. Old UI: flag `false`. New UI: `setDevFlag('BUDGET_BANKIN', true)`. Switch without rebuild.

### Q: How long does a full build take?

**A:** `npm run build` ~15-30 seconds. `npm run dev` hot-reload is instant.

### Q: Do I need to deploy each phase?

**A:** No. Each phase is a commit. You push to the feature branch `claude/bankin-style-frontend-NJn0a`. QA/staging comes later.

### Q: What's the rollback plan?

**A:** If critical bug: disable flag in `.env.production`, redeploy. Takes ~5 minutes.

---

## Getting Started RIGHT NOW

1. **Phase 0 setup** (30 min):

   ```bash
   cp .env.local.example .env.local
   npm install react-router-dom @types/react-router-dom
   npm test
   npm run dev
   ```

2. **Read this:**
   - `docs/FEATURE_FLAGS_QUICK_REFERENCE.md` (5 min)
   - `docs/adr/001-bankin-frontend-migration.md` (10 min)

3. **Start Phase 1:**
   - Read `docs/IMPLEMENTATION_CHECKLIST.md` Phase 1
   - Create `public/src/components/shared/MonthNavigator.tsx`
   - Create tests
   - Commit

---

## Questions?

Refer to:

- **"How do I use flags?"** → `FEATURE_FLAGS_QUICK_REFERENCE.md`
- **"What should I build?"** → `IMPLEMENTATION_CHECKLIST.md`
- **"How do I commit?"** → `GIT_COMMIT_MESSAGES.md`
- **"Why are we doing this?"** → `docs/adr/001-bankin-frontend-migration.md`

---

**Let's build this. You got this. 🚀**
