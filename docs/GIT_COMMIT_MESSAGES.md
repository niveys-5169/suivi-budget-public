# Git Commit Message Guide — Bankin Migration

Follow these patterns when committing Bankin frontend migration work.

---

## Format

```
<type>(<scope>): <subject> [FLAG: flagname]

<body>

Closes #<issue>
https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

---

## Types

- **feat:** New feature (new component, new page)
- **refactor:** Restructure without changing behavior
- **chore:** Setup, config, dependencies
- **test:** Add/update tests
- **docs:** Documentation only
- **fix:** Bug fix

---

## Scopes

- `(analyse)` — AnalyseSection and related components
- `(budget-bankin)` — BudgetsPage redesign
- `(shared)` — Shared components (MonthNavigator, DonutChart, etc.)
- `(nav)` — Navigation, routing, bottom nav
- `(design)` — Design system, colors, DESIGN_SYSTEM.md
- `(config)` — Feature flags, env, setup

---

## Subject Line

- Imperative mood ("add" not "added")
- No period at end
- Max 50 characters
- Include FLAG annotation if feature-flagged

---

## Body

Optional, but recommended. Explain:

- **Why** this change
- What **problem** it solves
- Any **breaking changes** or **side effects**

---

## Flag Annotation

If the commit is behind a feature flag, add `[FLAG: flagname]`:

```
feat(budget-bankin): Add BankinBudgetMain component [FLAG: BUDGET_BANKIN]

Implements main budget overview page with area chart and category grid.
Uses Recharts for area chart, custom SVG for sparklines.
Temporarily gated behind VITE_BUDGET_BANKIN flag for safe rollout.

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

---

## Examples

### Phase 0 Setup

```
chore(config): Install React Router and setup feature flags

- Add react-router-dom@6.x dependency
- Create .env.local and .env.production
- Create lib/featureFlags.ts with FLAGS constant
- Create docs/FEATURE_FLAGS.md guide
- Add category color palette to design system

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

### Phase 1 Shared Components

```
feat(shared): Add MonthNavigator component

Reusable component for month navigation (< April 2026 >).
Used by both Analyse and Budget pages.

- Prev/next buttons
- Date range calculation (first to last day of month)
- AURUM styling (gold text, platinum labels)
- Tests covering month boundary cases

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

### Phase 2 Analyse

```
feat(analyse): Create AnalyseSection with Entrées/Sorties tabs [FLAG: ANALYSE_PAGE]

New analysis page showing income/expense breakdown via donut charts.

- AnalyseTabs (Entrées | Sorties | Récurrences)
- AnalyseDonutCard using new DonutChart component
- AnalyseCategoryRow with amount and transaction count
- Integration with useTransactions hook (no backend changes)
- Behind VITE_ANALYSE_PAGE flag for safe rollout

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

### Phase 3 Budget Redesign

```
feat(budget-bankin): Redesign Budget page in Bankin style [FLAG: BUDGET_BANKIN]

Complete redesign of budget console to match Bankin UI:

- BankinBudgetMain: header with amount, progress bar, area chart
- BankinBudgetGrid: 2-column grid of category cards with sparklines
- BankinBudgetCategoryDetail: detailed view per category
- Navigation state machine for main → detail → main flow
- Area chart showing cumulative spending over month days
- Recharts for main area chart, SVG sparklines for grid

Gated behind VITE_BUDGET_BANKIN flag. Old BudgetsPage preserved
as fallback when flag is false.

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

### Phase 4 Navigation

```
feat(nav): Setup React Router and update BottomNav to 5 tabs

- Add BrowserRouter wrapper at app root
- Define routes: /, /analyse, /budgets, /budgets/:categoryId, /patrimoine, /transactions
- Migrate BottomNav to use Link component
- Update page navigation from scrollToPanel() to navigate()
- BottomNav now shows 5 items: Comptes | Analyse | Budgets | Patrimoine | Flux

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

### Phase 5 Cleanup

```
refactor(budget-bankin): Remove feature flag, make Bankin UI permanent

After 1 week monitoring in production, Bankin budget design is stable.

- Remove FLAGS.BUDGET_BANKIN conditional logic
- Keep only BankinBudgetMain code path
- Remove VITE_BUDGET_BANKIN from .env files
- Remove legacy BudgetsPage fallback code
- Tests updated to only cover new code path

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

### Bug Fix During Development

```
fix(shared): DonutChart center label alignment on mobile

Center text was being cut off on screens < 400px wide.

- Adjust font sizes for mobile (text-xl on mobile, text-3xl on desktop)
- Add padding to center text container
- Test on 375px viewport

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

### Documentation

```
docs: Add FEATURE_FLAGS guide for developers

- Explain how flags work (compile-time tree-shaking)
- Show usage examples
- Document localStorage override for dev testing
- Add troubleshooting section

https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

---

## Commit Frequency

- **Phase 0:** 1 commit (all setup)
- **Phase 1:** 1 commit per component (MonthNavigator, DonutChart, AreaSparkline) = 3 commits
- **Phase 2:** 1 commit (entire AnalyseSection)
- **Phase 3:** 1 commit (entire Budget redesign) or separate if it's large
- **Phase 4:** 1 commit (Router setup + BottomNav migration)
- **Phase 5:** 1 commit (Cleanup — remove flags)

**Total:** ~7-10 commits for the entire migration

---

## Session Reference

All commits should end with the current session URL:

```
https://claude.ai/code/session_01MARmsBcFJXhLkrySWTwdMc
```

This allows future developers to trace back to the context of why the code was written.

---

## Testing Before Commit

```bash
# 1. Run tests
npm test

# 2. Lint check
npm run lint

# 3. Type check
npm run build

# 4. Manual test (if UI change)
npm run dev
# Open http://localhost:3000
# Test the feature

# 5. Commit if all pass
git add .
git commit -m "feat(scope): description [FLAG: flagname]"

# 6. Push to feature branch
git push -u origin claude/bankin-style-frontend-NJn0a
```
