# Bankin Frontend Migration — Implementation Checklist

**Overall Status:** Ready for Phase 0 Setup

---

## Phase 0: Setup & Configuration (Pre-coding)

### Infrastructure

- [x] ADR created: `docs/adr/001-bankin-frontend-migration.md`
- [x] Feature flags guide: `docs/FEATURE_FLAGS.md`
- [x] Environment files: `.env.local.example`, `.env.production`
- [x] Feature flags module: `public/src/lib/featureFlags.ts`

### Pre-Coding Tasks (for Gemini)

#### 0.1: Install React Router

```bash
cd /home/user/Suivi-Budget
npm install react-router-dom
npm install -D @types/react-router-dom  # TypeScript types
```

- [ ] Verify in `package.json`: `react-router-dom@^6.x`
- [ ] Run `npm install` successfully

#### 0.2: Create `.env.local` from template

```bash
cp .env.local.example .env.local
```

- [ ] File exists: `/home/user/Suivi-Budget/.env.local`
- [ ] Contains: `VITE_ANALYSE_PAGE=false`, `VITE_BUDGET_BANKIN=false`, `VITE_BOTTOMNAV_V2=false`

#### 0.3: Extend Design System Colors

**Update:** `public/src/lib/colors.ts` or `tailwind.config.js`

Add category color palette (desaturated, dark-mode compatible):

```typescript
// public/src/lib/colors.ts
export const CATEGORY_COLORS = {
  housing: '#6B5B95', // Purple (rent, mortgage)
  transport: '#00A8A8', // Teal (cars, fuel, transit)
  food: '#C8956F', // Warm brown (groceries, dining)
  health: '#E98080', // Soft red (medical, pharmacy)
  entertainment: '#F5A962', // Orange (cinema, games, hobbies)
  shopping: '#D9A4B8', // Mauve (clothes, general shopping)
  utilities: '#88A4C2', // Blue-grey (electricity, water, internet)
  other: '#8B8B8B', // Grey (uncategorized)
} as const;
```

Or add to Tailwind:

```javascript
// tailwind.config.js
colors: {
  // ... existing gold/ink/platinum ...
  category: {
    housing:        '#6B5B95',
    transport:      '#00A8A8',
    // ... etc
  }
}
```

- [ ] Colors added to design system
- [ ] Test hex values on dark background (#0B0B14) — verify contrast with WCAG AA
- [ ] Update `DESIGN_SYSTEM.md` section "Category Colors"

#### 0.4: Update TypeScript Config (if needed)

Ensure `public/tsconfig.json` has path alias for imports:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] Path alias `@/` resolves to `public/src/`
- [ ] Run `npm run build` — no TypeScript errors

#### 0.5: Verify Vite Config

Check `vite.config.js`:

- [ ] `root: 'public'` is set correctly
- [ ] `build.outDir: '../dist'` points to root dist
- [ ] React plugin is enabled

#### 0.6: Create Initial Test

**File:** `public/src/lib/__tests__/featureFlags.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { FLAGS, setDevFlag } from '../featureFlags';

describe('Feature Flags', () => {
  it('should export FLAGS object with all flags as booleans', () => {
    expect(typeof FLAGS.ANALYSE_PAGE).toBe('boolean');
    expect(typeof FLAGS.BUDGET_BANKIN).toBe('boolean');
    expect(typeof FLAGS.BOTTOMNAV_V2).toBe('boolean');
  });

  it('should have all flags false by default in test env', () => {
    // In test env (.env.test), flags default to false
    expect(FLAGS.ANALYSE_PAGE).toBe(false);
    expect(FLAGS.BUDGET_BANKIN).toBe(false);
    expect(FLAGS.BOTTOMNAV_V2).toBe(false);
  });
});
```

- [ ] Test file created
- [ ] Run `npm test` — passes

---

## Phase 1: Shared Components (Days 2-3)

### 1.1: MonthNavigator Component

- [ ] File: `public/src/components/shared/MonthNavigator.tsx`
- [ ] Props: `month: Date`, `onChange: (date: Date) => void`
- [ ] Renders: `< April 2026 >`
- [ ] Buttons: prev/next month
- [ ] Returns date range: `{ start: Date, end: Date }`
- [ ] Style: gold text, platinum muted labels, AURUM theme
- [ ] Test: navigating prev/next, boundary months (Jan/Dec)

### 1.2: DonutChart Component

- [ ] File: `public/src/components/shared/DonutChart.tsx`
- [ ] Lib: Recharts (PieChart + Pie with innerRadius)
- [ ] Center: amount in serif, label below
- [ ] Props: `data: { label, value, color }[]`, `centerAmount`, `centerLabel`
- [ ] Colors: segments use provided colors (category palette)
- [ ] Animation: Framer Motion entry + hover
- [ ] Test: renders correct segments, center text matches props

### 1.3: AreaSparkline Component

- [ ] File: `public/src/components/shared/AreaSparkline.tsx`
- [ ] Lib: SVG path (no Recharts)
- [ ] Props: `data: { day, amount }[]`, `isOver: boolean`, `budget: number`
- [ ] Color: gold if under budget, ruby if over
- [ ] Responsive: fits inside container, no overflow
- [ ] Test: correct path calculation, color based on budget

### 1.4: PageHeader Component

- [ ] File: `public/src/components/shared/PageHeader.tsx`
- [ ] Reusable header: back arrow, title, optional icons (settings, search)
- [ ] Props: `title`, `onBack?: () => void`, `rightActions?: ReactNode`
- [ ] Style: sticky, backdrop blur, gold accent line

---

## Phase 2: Analyse Page (Days 4-5)

### 2.1: AnalyseSection (New Panel)

- [ ] File: `public/src/components/analyse/AnalyseSection.tsx`
- [ ] Mount point: `mount('analyse-root', AnalyseSection)` in `main.js`
- [ ] Hooks: `useTransactions()`, `useBudget()`
- [ ] State: `activeTab` (Entrées | Sorties | Récurrences), `currentMonth`

### 2.2: AnalyseTabs

- [ ] Tabs: pill buttons (blue/gold when active)
- [ ] Entrées: income transactions (amount > 0)
- [ ] Sorties: expense transactions (amount < 0)
- [ ] Récurrences: filtered by `isRecurring` field

### 2.3: AnalyseDonutCard

- [ ] Uses `DonutChart` component
- [ ] Shows: sum of category amounts in center
- [ ] Segments: each category with its color

### 2.4: AnalyseCategoryRow

- [ ] Each row: icon | name | amount | % | transaction count
- [ ] Clickable: navigate to category detail (future)

### 2.5: Tests

- [ ] Tab switching works
- [ ] Correct transactions shown per tab
- [ ] Donut total matches sum of segments

---

## Phase 3: Budget Redesign (Days 6-7)

### 3.1: BankinBudgetMain

- [ ] File: `public/src/components/budgets-v2/BankinBudgetMain.tsx`
- [ ] Header: "Budget" + month navigator
- [ ] Main card:
  - [ ] Amount spent (large, gold)
  - [ ] Status: "Dépensé ce mois-ci" + dot (green/red)
  - [ ] Progress bar: blue/purple fill
  - [ ] Sub-cards: Budget total | Restant
  - [ ] Comparison: "Comparez avec le mois précédent >"
  - [ ] Area chart: cumul dépenses par jour (1-30)
  - [ ] Buttons: "Historique" | "Suivre Objectif d'épargne"
- [ ] Grid: 2-column category cards below

### 3.2: BankinBudgetGrid

- [ ] Each card (2 cols): name, icon, spent/budget, mini sparkline
- [ ] Color: category color border
- [ ] Click: navigate to detail page

### 3.3: BankinBudgetCategoryDetail

- [ ] Header: colored background per category
- [ ] Same layout as BankinBudgetMain but for single category
- [ ] Show sub-categories below

### 3.4: Navigation State Machine

- [ ] In `BudgetsPage.tsx`: manage view state
  - `type: 'main'`
  - `type: 'category', budgetId: string`
- [ ] No page refresh between states
- [ ] Back button returns to main

### 3.5: Tests

- [ ] All amounts calculated correctly
- [ ] Progress bar % matches spent/budget ratio
- [ ] Area chart shows monotonic increase
- [ ] Category detail filters correctly

---

## Phase 4: Navigation & React Router (Day 8)

### 4.1: Setup Router

- [ ] Wrap `<App>` in `<BrowserRouter>`
- [ ] Define routes:
  - `/` → Dashboard
  - `/analyse` → Analyse
  - `/budgets` → Budget main
  - `/budgets/:categoryId` → Category detail
  - `/patrimoine` → Patrimoine
  - `/transactions` → Transactions
- [ ] Update `BottomNav` to use `<Link>` instead of manual scroll

### 4.2: Update BottomNav

- [ ] Add 5th item: "Analyse"
- [ ] Icons: Landmark, PieChart, BarChart3, TrendingUp, ArrowLeftRight
- [ ] Use React Router `Link` component

### 4.3: Migrate scrollToPanel()

- [ ] Replace `window.scrollToPanel()` calls with `navigate()`
- [ ] Update legacy `app.js` routing if needed

### 4.4: Tests

- [ ] Navigation links work
- [ ] Deep-link `/budgets/housing` loads category detail
- [ ] Browser back/forward buttons work
- [ ] Refresh on any route keeps state

---

## Phase 5: Stabilization (Week 2)

### 5.1: Feature Flag Rollout

- [ ] `.env.local`: enable flags for final testing
- [ ] Deploy to staging with flags enabled
- [ ] Staging QA passes all test cases

### 5.2: Production Rollout

- [ ] Enable flags in prod `.env` (or CI/CD)
- [ ] Deploy to production
- [ ] Monitor error rates, performance metrics (Sentry, etc.)
- [ ] Wait 1 week before cleanup

### 5.3: Cleanup

- [ ] Remove feature flag checks in code
- [ ] Remove flags from `.env` files
- [ ] Remove `FLAGS` import statements (no longer needed)
- [ ] Remove `react-chartjs-2` from `package.json` if unused
- [ ] Merge cleanup PR

---

## Testing Checklist

### TypeScript / Linting

- [ ] `npm run build` — zero TypeScript errors
- [ ] `npm run lint` — zero ESLint warnings
- [ ] No unused imports

### Bundle

- [ ] `npm run build` output size < previous (flags tree-shaken)
- [ ] Verify old code not in `dist/assets/*.js` when flags are true

### Unit Tests

- [ ] `npm test` — all tests pass
- [ ] New components have >80% coverage

### Manual Testing (Mobile 375px + Desktop 1920px)

- [ ] Dashboard loads, no layout shift
- [ ] Analyse tab visible, donut chart renders
- [ ] Budget main shows area chart, grid is 2 columns
- [ ] Category detail page works, back button returns to main
- [ ] Month navigation works (prev/next)
- [ ] All bottom nav items clickable
- [ ] localStorage override flags work in dev

### Accessibility

- [ ] Color contrast: category colors pass WCAG AA
- [ ] Keyboard navigation: Tab through all interactive elements
- [ ] Screen reader: headers, labels, buttons announced correctly

### Regression Testing

- [ ] Transactions page works unchanged
- [ ] Patrimoine page works unchanged
- [ ] Settings/Advanced features work unchanged
- [ ] All Firebase hooks still functional (no API changes)

---

## Rollback Plan

If critical bug found:

1. **Dev:** Disable flag in `.env.local`, run tests again
2. **Staging:** Disable flag in staging `.env`, redeploy
3. **Prod:** Disable flag in prod `.env` or CI/CD, redeploy
4. Investigate root cause
5. Fix, test locally, re-enable when ready

**Rollback time:** ~5 minutes (simple env var change + redeploy)

---

## Sign-Off

- [ ] All phases complete
- [ ] All tests passing
- [ ] Code review approved
- [ ] PM/Design sign-off on UI
- [ ] Ready for release notes
