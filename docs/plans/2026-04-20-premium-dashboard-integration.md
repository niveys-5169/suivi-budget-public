# Premium Dashboard Integration Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the fragmented "Premium Experience" into the unified, real-data-driven default dashboard with full Tailwind CSS support.

**Architecture:**

- Centralize data flow using `useDashboard.tsx` (real Firestore data) instead of `useDashboardData.ts` (mock).
- Implement a unified "Dark Glass" design system using Tailwind CSS tokens.
- Replace the legacy "Premium" toggle with the new high-fidelity UI as the permanent default.

**Tech Stack:** React 18, Tailwind CSS, Framer Motion, Recharts, Lucide Icons, Vitest.

---

### Task 1: Tailwind CSS Infrastructure & Configuration

**Files:**

- Create: `public/tailwind.config.js`
- Create: `public/src/premium.css`
- Modify: `public/index.html:12-25`

**Step 1: Create Tailwind configuration with custom theme tokens**

```javascript
// public/tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './index.html'],
  theme: {
    extend: {
      colors: {
        primary: '#0A0A0B',
        gold: '#D4AF37',
        accent: {
          DEFAULT: '#D4AF37',
          hover: '#C5A028',
        },
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.1)',
        },
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
```

**Step 2: Create base CSS with Tailwind directives**

```css
/* public/src/premium.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-primary text-white font-inter;
  }
}
```

**Step 3: Update index.html to use the compiled CSS (or proper Tailwind build process)**

Run: `npm install -D tailwindcss postcss autoprefixer`
Expected: PASS

**Step 4: Commit baseline infrastructure**

```bash
git add public/tailwind.config.js public/src/premium.css package.json
git commit -m "feat: setup tailwind css infrastructure"
```

---

### Task 2: Connect Premium Dashboard to Real Data

**Files:**

- Modify: `public/src/components/dashboard/Dashboard.tsx`
- Modify: `public/src/components/DashboardSection.tsx`

**Step 1: Update Dashboard.tsx to accept real props or use the real hook**

```typescript
// public/src/components/dashboard/Dashboard.tsx
import { useDashboard } from '../../hooks/useDashboard';
// ... replace useDashboardData with useDashboard
```

**Step 2: Map real data to Premium components**

- `totalBalance` from `stats.solde`
- `recentTransactions` from `filteredTransactions`
- `budgets` from Firestore (via `useDashboard`)

**Step 3: Verify with a test**

Run: `npm test`
Expected: PASS (if tests updated to mock useDashboard correctly)

**Step 4: Commit data connection**

```bash
git add public/src/components/dashboard/Dashboard.tsx
git commit -m "feat: connect premium dashboard to real firestore data"
```

---

### Task 3: Refine BalanceHero with Real History & Variation

**Files:**

- Modify: `public/src/components/dashboard/BalanceHero.tsx`

**Step 1: Implement dynamic sparkline calculation**

Compute a 30-day balance history array based on the `transactions` list.

**Step 2: Add interactive "Privacy Mode" persistence**

Ensure the `isVisible` state is saved to `localStorage` (or `usePreferences`).

**Step 3: Commit UI refinements**

```bash
git add public/src/components/dashboard/BalanceHero.tsx
git commit -m "feat: implement real sparkline and privacy persistence in BalanceHero"
```

---

### Task 4: Unified UI Launch (Cleanup)

**Files:**

- Modify: `public/src/components/DashboardSection.tsx`
- Modify: `public/index.html`

**Step 1: Remove the "Premium Mode" toggle and make it default**

**Step 2: Remove legacy chart bridges if no longer needed**

**Step 3: Run final validation**

Run: `npm run build`
Expected: Success with no CSS errors.

**Step 4: Final Commit**

```bash
git add .
git commit -m "feat: promote premium dashboard to default UI"
```
